from fastapi import APIRouter, HTTPException, Body, UploadFile, File
from typing import List, Optional
from datetime import datetime, timezone
from pathlib import Path
import uuid
import asyncio
import logging
import base64

from database import db
from models import Job
from services.audit import log_audit
from services.notifications import (
    send_notification_to_operators, send_notification_to_managers,
    send_notification_to_plan_users
)
from websocket_manager import ws_manager, ws_manager_mgmt

router = APIRouter()


# Dosya Yükleme Endpoint'i
@router.post("/upload/image")
async def upload_image(file: UploadFile = File(...)):
    """Görsel yükle ve Base64 olarak MongoDB'ye kaydet"""
    try:
        allowed_extensions = [".jpg", ".jpeg", ".png", ".gif", ".webp"]
        file_ext = Path(file.filename).suffix.lower()
        if file_ext not in allowed_extensions:
            raise HTTPException(status_code=400, detail="Sadece resim dosyaları yüklenebilir (jpg, jpeg, png, gif, webp)")

        content = await file.read()
        if len(content) > 5 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="Dosya boyutu 5MB'dan küçük olmalı")

        base64_data = base64.b64encode(content).decode('utf-8')

        mime_types = {
            ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
            ".png": "image/png", ".gif": "image/gif", ".webp": "image/webp"
        }
        mime_type = mime_types.get(file_ext, "image/jpeg")
        data_url = f"data:{mime_type};base64,{base64_data}"

        image_id = str(uuid.uuid4())
        await db.images.insert_one({
            "id": image_id, "filename": file.filename,
            "mime_type": mime_type, "data": data_url,
            "created_at": datetime.now(timezone.utc).isoformat()
        })

        return {"success": True, "filename": file.filename, "url": data_url, "image_id": image_id}
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Upload error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/jobs", response_model=List[Job])
async def get_jobs(status: Optional[str] = None, machine_id: Optional[str] = None, search: Optional[str] = None):
    query = {}
    if status:
        query["status"] = status
    if machine_id:
        query["machine_id"] = machine_id
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"colors": {"$regex": search, "$options": "i"}}
        ]
    jobs = await db.jobs.find(query, {"_id": 0}).sort("created_at", 1).to_list(1000)
    return jobs


@router.post("/jobs", response_model=Job)
async def create_job(job: Job, created_by: str = None):
    doc = job.model_dump()
    await db.jobs.insert_one(doc)

    await log_audit(created_by or "Plan", "create", "job", job.name, f"Makine: {job.machine_name}, Koli: {job.koli_count}")

    try:
        await send_notification_to_operators(
            machine_id=job.machine_id,
            title="Yeni Is Atandi",
            body=f"{job.name} - {job.machine_name}\n{job.koli_count} koli",
            data={"type": "new_job", "job_id": job.id, "machine_id": job.machine_id}
        )
    except Exception as e:
        logging.error(f"FCM notification error for new job: {e}")

    return job


@router.post("/jobs/{job_id}/clone", response_model=Job)
async def clone_job(job_id: str, updates: dict = Body(...)):
    original_job = await db.jobs.find_one({"id": job_id}, {"_id": 0})
    if not original_job:
        raise HTTPException(status_code=404, detail="Job not found")

    new_job = Job(
        name=updates.get("name", original_job["name"]),
        koli_count=updates.get("koli_count", original_job["koli_count"]),
        colors=updates.get("colors", original_job["colors"]),
        machine_id=updates.get("machine_id", original_job["machine_id"]),
        machine_name=updates.get("machine_name", original_job["machine_name"]),
        format=updates.get("format", original_job.get("format")),
        notes=updates.get("notes", original_job.get("notes")),
        delivery_date=updates.get("delivery_date", original_job.get("delivery_date"))
    )

    doc = new_job.model_dump()
    await db.jobs.insert_one(doc)

    cloned_by = updates.get("created_by", "Plan")
    await log_audit(cloned_by, "create", "job", new_job.name, f"Kopyalandi - Makine: {new_job.machine_name}")

    return new_job


# Batch reorder - MUST be before /jobs/{job_id} to avoid wildcard conflict
@router.put("/jobs/reorder-batch")
async def reorder_jobs_batch(data: dict = Body(...)):
    """Birden fazla işin sırasını değiştir"""
    job_orders = data.get("jobs", [])
    for item in job_orders:
        await db.jobs.update_one(
            {"id": item["job_id"]},
            {"$set": {"order": item["order"]}}
        )
    return {"success": True}


# Müşteri Sipariş Takip (güvenli link)
@router.get("/takip/{tracking_token}")
async def track_job(tracking_token: str):
    """Müşteri için özel link ile sipariş takip"""
    job = await db.jobs.find_one({"tracking_code": tracking_token}, {"_id": 0})
    if not job:
        raise HTTPException(status_code=404, detail="Takip linki geçersiz")

    status_map = {
        "pending": "Sırada Bekliyor",
        "in_progress": "Üretimde",
        "paused": "Beklemede",
        "completed": "Tamamlandı"
    }

    started_at_tr = None
    if job.get("started_at"):
        try:
            from zoneinfo import ZoneInfo
            utc_dt = datetime.fromisoformat(job["started_at"].replace("Z", "+00:00"))
            tr_dt = utc_dt.astimezone(ZoneInfo("Europe/Istanbul"))
            started_at_tr = tr_dt.strftime("%d %B %Y, %H:%M")
            months_tr = {"January": "Ocak", "February": "Şubat", "March": "Mart", "April": "Nisan",
                         "May": "Mayıs", "June": "Haziran", "July": "Temmuz", "August": "Ağustos",
                         "September": "Eylül", "October": "Ekim", "November": "Kasım", "December": "Aralık"}
            for en, tr in months_tr.items():
                started_at_tr = started_at_tr.replace(en, tr)
        except Exception:
            started_at_tr = job.get("started_at", "")

    return {
        "job_name": job.get("name", ""),
        "status": job.get("status", "pending"),
        "status_text": status_map.get(job.get("status", "pending"), "Bilinmiyor"),
        "started_at_tr": started_at_tr,
        "completed_at": job.get("completed_at")
    }


# Operatör listesi (Yönetim paneli için)
@router.get("/operators/list")
async def get_operators_list():
    """Aktif operatörlerin listesini döndür"""
    operators = await db.users.find(
        {"role": "operator", "is_active": True},
        {"_id": 0, "id": 1, "username": 1, "display_name": 1}
    ).to_list(100)
    return [{"id": o.get("id", o.get("username")), "name": o.get("display_name", o.get("username", ""))} for o in operators]


# Durdurulan İşleri Listele
@router.get("/jobs/paused")
async def get_paused_jobs():
    """Durdurulmuş işleri listele"""
    paused = await db.jobs.find({"status": "paused"}, {"_id": 0}).to_list(100)
    return paused


@router.put("/jobs/{job_id}", response_model=Job)
async def update_job(job_id: str, updates: dict = Body(...)):
    job = await db.jobs.find_one({"id": job_id}, {"_id": 0})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    updated_by = updates.pop("updated_by", None) or "Yonetim"
    await db.jobs.update_one({"id": job_id}, {"$set": updates})

    await log_audit(updated_by, "update", "job", job.get("name", ""), f"Guncellenen: {', '.join(updates.keys())}")

    updated_job = await db.jobs.find_one({"id": job_id}, {"_id": 0})
    return Job(**updated_job)


@router.delete("/jobs/{job_id}")
async def delete_job(job_id: str, deleted_by: str = None):
    job = await db.jobs.find_one({"id": job_id}, {"_id": 0})
    result = await db.jobs.delete_one({"id": job_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Job not found")
    await log_audit(deleted_by or "Yonetim", "delete", "job", job.get("name", "") if job else job_id)
    return {"message": "Job deleted"}


@router.put("/jobs/{job_id}/start")
async def start_job(job_id: str, data: dict = Body(...)):
    operator_name = data.get("operator_name")
    job = await db.jobs.find_one({"id": job_id}, {"_id": 0})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    await db.jobs.update_one(
        {"id": job_id},
        {"$set": {
            "status": "in_progress",
            "operator_name": operator_name,
            "started_at": datetime.now(timezone.utc).isoformat()
        }}
    )

    await db.machines.update_one(
        {"id": job["machine_id"]},
        {"$set": {"status": "working", "current_job_id": job_id}}
    )

    await log_audit(operator_name or "Operator", "start", "job", job.get("name", ""), f"Makine: {job.get('machine_name', '')}")

    return {"message": "Job started"}


@router.put("/jobs/{job_id}/complete")
async def complete_job(job_id: str, data: dict = Body(None)):
    job = await db.jobs.find_one({"id": job_id}, {"_id": 0})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    completed_koli = data.get("completed_koli", job["koli_count"]) if data else job["koli_count"]

    await db.jobs.update_one(
        {"id": job_id},
        {"$set": {
            "status": "completed",
            "completed_at": datetime.now(timezone.utc).isoformat(),
            "completed_koli": completed_koli
        }}
    )

    await db.machines.update_one(
        {"id": job["machine_id"]},
        {"$set": {"status": "idle", "current_job_id": None}}
    )

    await log_audit(job.get("operator_name", "Operator"), "complete", "job", job.get("name", ""), f"Koli: {completed_koli}")

    asyncio.create_task(_send_completion_notifications(job, job_id, completed_koli))

    return {"success": True, "message": "İş tamamlandı"}


async def _send_completion_notifications(job: dict, job_id: str, completed_koli: int):
    """Bildirimler arka planda gönderilir"""
    try:
        notification_title = "Is Tamamlandi!"
        notification_body = f"{job['name']}\n{job['machine_name']}\n{completed_koli} koli"
        message = f"Is Tamamlandi!\n\nIs: {job['name']}\nMakine: {job['machine_name']}\nKoli: {completed_koli}\nOperator: {job.get('operator_name', '-')}\nTarih: {datetime.now(timezone.utc).strftime('%d.%m.%Y %H:%M')}"

        await asyncio.gather(
            send_notification_to_managers(
                title=notification_title, body=notification_body,
                data={"type": "job_completed", "job_id": job_id}
            ),
            send_notification_to_plan_users(
                title=notification_title, body=notification_body,
                data={"type": "job_completed", "job_id": job_id}
            ),
            return_exceptions=True
        )

        await ws_manager_mgmt.broadcast_to_managers({
            "type": "job_completed", "message": message,
            "job_name": job['name'], "machine_name": job['machine_name'],
            "completed_koli": completed_koli
        })
    except Exception as e:
        logging.error(f"Background notification error: {e}")


@router.put("/jobs/{job_id}/pause")
async def pause_job(job_id: str, data: dict = Body(...)):
    """İşi durdur ve sebep not et"""
    pause_reason = data.get("pause_reason", "")
    produced_koli = data.get("produced_koli", 0)

    job = await db.jobs.find_one({"id": job_id}, {"_id": 0})
    if not job:
        raise HTTPException(status_code=404, detail="İş bulunamadı")

    if job["status"] != "in_progress":
        raise HTTPException(status_code=400, detail="Sadece devam eden işler durdurulabilir")

    await db.jobs.update_one(
        {"id": job_id},
        {"$set": {
            "status": "paused",
            "paused_at": datetime.now(timezone.utc).isoformat(),
            "pause_reason": pause_reason,
            "produced_before_pause": produced_koli
        }}
    )

    await db.machines.update_one(
        {"id": job["machine_id"]},
        {"$set": {"status": "idle", "current_job_id": None}}
    )

    await ws_manager.broadcast({
        "type": "job_paused",
        "data": {
            "job_id": job_id, "job_name": job["name"],
            "machine_id": job["machine_id"], "pause_reason": pause_reason
        }
    })

    await log_audit(job.get("operator_name", "Operator"), "pause", "job", job.get("name", ""), f"Sebep: {pause_reason}")

    return {"message": "İş durduruldu", "job_id": job_id}


@router.put("/jobs/{job_id}/resume")
async def resume_job(job_id: str, data: dict = Body(...)):
    """Durdurulan işe devam et"""
    operator_name = data.get("operator_name", "")

    job = await db.jobs.find_one({"id": job_id}, {"_id": 0})
    if not job:
        raise HTTPException(status_code=404, detail="İş bulunamadı")

    if job["status"] != "paused":
        raise HTTPException(status_code=400, detail="Sadece durdurulmuş işlere devam edilebilir")

    active_on_machine = await db.jobs.find_one({
        "machine_id": job["machine_id"], "status": "in_progress"
    })
    if active_on_machine:
        raise HTTPException(status_code=400, detail="Bu makinede zaten aktif bir iş var")

    await db.jobs.update_one(
        {"id": job_id},
        {"$set": {
            "status": "in_progress",
            "operator_name": operator_name or job.get("operator_name"),
            "started_at": datetime.now(timezone.utc).isoformat()
        }}
    )

    await db.machines.update_one(
        {"id": job["machine_id"]},
        {"$set": {"status": "working", "current_job_id": job_id}}
    )

    await log_audit(operator_name or "Operator", "resume", "job", job.get("name", ""), f"Makine: {job.get('machine_name', '')}")

    return {"message": "İşe devam edildi", "job_id": job_id}


@router.put("/jobs/{job_id}/reorder")
async def reorder_job(job_id: str, data: dict = Body(...)):
    """İşin sırasını değiştir"""
    new_order = data.get("order", 0)
    await db.jobs.update_one({"id": job_id}, {"$set": {"order": new_order}})
    return {"success": True}


@router.post("/jobs/{job_id}/quick-transfer")
async def quick_transfer_job(job_id: str, data: dict = Body(...)):
    """Pending veya paused işi başka bir makineye aktar."""
    target_machine_id = data.get("target_machine_id")
    produced_koli = data.get("produced_koli", 0)
    user_name = data.get("user_name", "Plan")

    if not target_machine_id:
        raise HTTPException(status_code=400, detail="Hedef makine seçilmedi")

    job = await db.jobs.find_one({"id": job_id}, {"_id": 0})
    if not job:
        raise HTTPException(status_code=404, detail="İş bulunamadı")

    if job["status"] not in ("pending", "paused"):
        raise HTTPException(status_code=400, detail="Sadece bekleyen veya durdurulmuş işler aktarılabilir")

    target_machine = await db.machines.find_one({"id": target_machine_id}, {"_id": 0})
    if not target_machine:
        raise HTTPException(status_code=404, detail="Hedef makine bulunamadı")

    already_produced = job.get("produced_before_pause", 0)
    total_produced = already_produced + produced_koli
    original_koli = job["koli_count"]

    transfer_entry = {
        "from_machine": job.get("machine_name", ""),
        "from_machine_id": job.get("machine_id", ""),
        "to_machine": target_machine["name"],
        "to_machine_id": target_machine_id,
        "produced_koli": total_produced,
        "transferred_at": datetime.now(timezone.utc).isoformat(),
        "transferred_by": user_name
    }
    existing_history = job.get("transfer_history", [])
    updated_history = existing_history + [transfer_entry]

    if total_produced > 0 and total_produced < original_koli:
        await db.jobs.update_one(
            {"id": job_id},
            {"$set": {
                "status": "completed",
                "completed_at": datetime.now(timezone.utc).isoformat(),
                "completed_koli": total_produced,
                "transfer_history": updated_history
            }}
        )
        remaining_koli = original_koli - total_produced
        new_job = Job(
            name=job["name"], koli_count=remaining_koli,
            colors=job.get("colors", ""), machine_id=target_machine_id,
            machine_name=target_machine["name"], format=job.get("format"),
            notes=job.get("notes", ""), delivery_date=job.get("delivery_date"),
            delivery_address=job.get("delivery_address"),
            delivery_phone=job.get("delivery_phone"),
            image_url=job.get("image_url"), status="pending", order=0,
            transfer_history=updated_history,
        )
        await db.jobs.insert_one(new_job.model_dump())

        await log_audit(
            user_name, "quick_transfer", "job", job.get("name", ""),
            f"Eski makine: {job.get('machine_name','')}, Yeni makine: {target_machine['name']}, Üretilen: {total_produced}, Kalan: {remaining_koli}"
        )
        return {
            "success": True,
            "message": f"{total_produced} koli tamamlandı, kalan {remaining_koli} koli {target_machine['name']} makinesine aktarıldı",
            "new_job_id": new_job.id, "split": True
        }
    else:
        if total_produced >= original_koli and total_produced > 0:
            await db.jobs.update_one(
                {"id": job_id},
                {"$set": {
                    "status": "completed",
                    "completed_at": datetime.now(timezone.utc).isoformat(),
                    "completed_koli": original_koli
                }}
            )
            await log_audit(
                user_name, "quick_complete", "job", job.get("name", ""),
                f"Makine: {job.get('machine_name','')}, Koli: {original_koli}"
            )
            return {"success": True, "message": f"İş tamamlandı ({original_koli} koli)", "split": False}
        else:
            await db.jobs.update_one(
                {"id": job_id},
                {"$set": {
                    "machine_id": target_machine_id,
                    "machine_name": target_machine["name"],
                    "status": "pending", "paused_at": None,
                    "pause_reason": None, "produced_before_pause": 0,
                    "queued_at": datetime.now(timezone.utc).isoformat(),
                    "transfer_history": updated_history
                }}
            )
            await log_audit(
                user_name, "quick_transfer", "job", job.get("name", ""),
                f"Eski makine: {job.get('machine_name','')}, Yeni makine: {target_machine['name']}, Koli: {original_koli}"
            )
            return {"success": True, "message": f"İş {target_machine['name']} makinesine aktarıldı ({original_koli} koli)", "split": False}
