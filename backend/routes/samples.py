"""Versioned customer proof approval. A timeout permits continuation, never impersonates approval."""
import asyncio
import base64
import io
import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Literal

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import Response
from PIL import Image, ImageOps, UnidentifiedImageError
from pydantic import BaseModel, Field
from pymongo.errors import DuplicateKeyError
from auth import get_current_user, get_user_roles, is_yonetim
from database import db

def no_store(response: Response):
    response.headers["Cache-Control"] = "private, no-store"


router = APIRouter(dependencies=[Depends(no_store)])
LABELS = {
    'awaiting_view': 'Müşterinin görüntülemesi bekleniyor',
    'pending': 'Müşteri yanıtı bekleniyor',
    'approved': 'Müşteri onayladı',
    'changes_requested': 'Düzeltme istendi — üretime devam etmeyin',
    'expired': 'Yanıt süresi doldu — numuneye göre üretime devam edilebilir',
}


def now():
    return datetime.now(timezone.utc).isoformat()



async def staff(user):
    roles = await get_user_roles(user)
    if not is_yonetim(roles) and 'operator' not in roles and 'plan' not in roles:
        raise HTTPException(403, 'Numune işlemi için yetkiniz yok')


async def job_for_token(token):
    job = await db.jobs.find_one({'tracking_code': token}, {'_id': 0, 'id': 1})
    if not job:
        raise HTTPException(404, 'Takip linki geçersiz')
    return job


async def settle(job_id):
    at = now()
    await db.sample_approvals.update_one(
        {'_id': job_id, 'status': 'pending', 'deadline': {'$ne': None, '$lte': at}},
        {'$set': {'status': 'expired', 'resolved_at': at},
         '$push': {'events': {'status': 'expired', 'at': at}}})
    return await db.sample_approvals.find_one({'_id': job_id})


async def require_sample_release(job_id):
    sample = await settle(job_id)
    if sample and sample['status'] not in ('approved', 'expired'):
        raise HTTPException(409, 'Numune onayı bekleniyor veya düzeltme istendi. Numune Onayı bölümünü kontrol edin.')


def public(sample):
    if not sample:
        return {'sample': None, 'server_time': now()}
    fields = ('revision', 'note', 'strict', 'status', 'created_at', 'viewed_at', 'deadline', 'resolved_at', 'response_note', 'respondent', 'events')
    result = {k: sample.get(k) for k in fields}
    result['status_text'] = LABELS[result['status']]
    result['history'] = [{k: old.get(k) for k in fields} for old in sample.get('history', [])]
    return {'sample': result, 'server_time': now()}


@router.get('/jobs/{job_id}/sample')
async def get_sample(job_id: str, user=Depends(get_current_user)):
    await staff(user)
    return public(await settle(job_id))


@router.post('/jobs/{job_id}/sample')
async def publish_sample(job_id: str, file: UploadFile = File(...), note: str = Form(''),
                         strict: bool = Form(False), expected_revision: str = Form(''), user=Depends(get_current_user)):
    await staff(user)
    job = await db.jobs.find_one({'id': job_id})
    if not job or job.get('status') == 'completed':
        raise HTTPException(409, 'Aktif bir sipariş seçin')
    if len(note) > 1000:
        raise HTTPException(422, 'Not en fazla 1000 karakter olabilir')
    old = await settle(job_id)
    if (old or {}).get('revision', '') != expected_revision:
        raise HTTPException(409, 'Numune değişti; ekranı yenileyin')
    if old and len(old.get('history', [])) >= 99:
        raise HTTPException(409, 'Bu sipariş için numune sınırına ulaşıldı')
    content = await file.read(8 * 1024 * 1024 + 1)
    if len(content) > 8 * 1024 * 1024:
        raise HTTPException(413, 'Fotoğraf en fazla 8 MB olabilir')
    try:
        with Image.open(io.BytesIO(content)) as original:
            if original.width * original.height > 20_000_000:
                raise ValueError('large image')
            photo = ImageOps.exif_transpose(original).convert('RGB')
            photo.thumbnail((1800, 1800))
            output = io.BytesIO()
            photo.save(output, 'JPEG', quality=88)
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError):
        raise HTTPException(422, 'Geçerli bir JPG, PNG veya WebP fotoğraf seçin')
    revision = uuid.uuid4().hex
    at = now()
    item = {'revision': revision, 'note': note.strip(), 'strict': strict,
            'status': 'awaiting_view', 'created_at': at, 'viewed_at': None, 'deadline': None,
            'created_by': user.get('sub'), 'events': [{'status': 'awaiting_view', 'at': at}],
            'history': (old.get('history', []) + [{k: v for k, v in old.items() if k not in ('_id', 'history')}]) if old else []}
    await db.sample_images.insert_one({'_id': revision, 'job_id': job_id, 'data': base64.b64encode(output.getvalue()).decode()})
    try:
        if old:
            result = await db.sample_approvals.replace_one({'_id': job_id, 'revision': expected_revision, 'status': old['status'], 'events': old['events']}, {'_id': job_id, **item})
            if not result.modified_count:
                raise HTTPException(409, 'Müşteri yanıtı veya numune değişti; tekrar kontrol edin')
        else:
            await db.sample_approvals.insert_one({'_id': job_id, **item})
    except (DuplicateKeyError, HTTPException):
        await db.sample_images.delete_one({'_id': revision})
        raise HTTPException(409, 'Numune değişti; ekranı yenileyin')
    return public(item)


@router.get('/takip/{token}/sample')
async def customer_sample(token: str):
    job = await job_for_token(token)
    return public(await settle(job['id']))


@router.get('/takip/{token}/sample/{revision}/image')
async def customer_image(token: str, revision: str):
    job = await job_for_token(token)
    return await image_response(job['id'], revision)


@router.get('/jobs/{job_id}/sample/{revision}/image')
async def staff_image(job_id: str, revision: str, user=Depends(get_current_user)):
    await staff(user)
    return await image_response(job_id, revision)


async def image_response(job_id, revision):
    image = await db.sample_images.find_one({'_id': revision, 'job_id': job_id})
    if not image:
        raise HTTPException(404, 'Fotoğraf bulunamadı')
    return Response(base64.b64decode(image['data']), media_type='image/jpeg', headers={'Cache-Control': 'private, no-store'})


@router.post('/takip/{token}/sample/{revision}/view')
async def view_sample(token: str, revision: str):
    job = await job_for_token(token)
    sample = await settle(job['id'])
    if not sample or sample['revision'] != revision:
        raise HTTPException(409, 'Yeni numune var; ekranı yenileyin')
    at = now()
    deadline = None if sample['strict'] else (datetime.fromisoformat(at) + timedelta(minutes=10)).isoformat()
    await db.sample_approvals.update_one({'_id': job['id'], 'revision': revision, 'status': 'awaiting_view'},
        {'$set': {'status': 'pending', 'viewed_at': at, 'deadline': deadline}, '$push': {'events': {'status': 'pending', 'at': at}}})
    return public(await settle(job['id']))


class Decision(BaseModel):
    decision: Literal['approved', 'changes_requested']
    note: str = Field(default='', max_length=1000)
    name: str = Field(min_length=2, max_length=100)


@router.post('/takip/{token}/sample/{revision}/decision')
async def decide(token: str, revision: str, body: Decision):
    job = await job_for_token(token)
    if len(body.name.strip()) < 2 or (body.decision == 'changes_requested' and not body.note.strip()):
        raise HTTPException(422, 'Adınızı ve düzeltme istiyorsanız açıklamanızı girin')
    await settle(job['id'])
    at = now()
    result = await db.sample_approvals.update_one(
        {'_id': job['id'], 'revision': revision, 'status': 'pending',
         '$or': [{'deadline': None}, {'deadline': {'$gt': at}}]},
        {'$set': {'status': body.decision, 'response_note': body.note.strip(), 'respondent': body.name.strip(), 'resolved_at': at},
         '$push': {'events': {'status': body.decision, 'at': at, 'name': body.name.strip(), 'note': body.note.strip()}}})
    if not result.modified_count:
        raise HTTPException(409, 'Süre doldu, yanıt kaydedildi veya numune değişti. Güncel durumu kontrol edin.')
    return public(await settle(job['id']))


async def expiry_worker():
    while True:
        try:
            cursor = db.sample_approvals.find({'status': 'pending', 'deadline': {'$ne': None, '$lte': now()}}, {'_id': 1})
            async for item in cursor:
                await settle(item['_id'])
        except Exception:
            logging.exception('Numune süreleri güncellenemedi')
        await asyncio.sleep(5)
