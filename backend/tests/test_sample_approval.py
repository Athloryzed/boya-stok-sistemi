"""Isolated route tests; no live MongoDB, notifications or customer data."""
import asyncio
import io
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

os.environ.setdefault('MONGO_URL', 'mongodb://127.0.0.1:27017')
os.environ.setdefault('DB_NAME', 'sample_approval_test')
os.environ.setdefault('JWT_SECRET', 'test-only-key-not-used-for-live-authentication')
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from mongomock_motor import AsyncMongoMockClient
from PIL import Image
import auth
from routes import samples


def run(coro):
    return asyncio.run(coro)


@pytest.fixture
def env(monkeypatch):
    database = AsyncMongoMockClient().test
    monkeypatch.setattr(samples, 'db', database)
    monkeypatch.setattr(auth, 'db', database)
    auth._roles_cache.clear()
    user = {'role': 'operator'}
    app = FastAPI()
    app.include_router(samples.router, prefix='/api')
    app.dependency_overrides[auth.get_current_user] = lambda: user
    run(database.jobs.insert_many([
        {'id': 'one', 'tracking_code': 'secret-one', 'status': 'in_progress'},
        {'id': 'two', 'tracking_code': 'secret-two', 'status': 'in_progress'},
    ]))
    with TestClient(app) as client:
        yield client, database, user


def publish(client, strict=False, previous='', content=None):
    if content is None:
        image = io.BytesIO()
        Image.new('RGB', (16, 16), 'gold').save(image, 'PNG')
        content = image.getvalue()
    return client.post('/api/jobs/one/sample', data={'note': 'İlk numune', 'strict': str(strict).lower(), 'expected_revision': previous}, files={'file': ('sample.png', content, 'image/png')})


def view(client, revision):
    return client.post(f'/api/takip/secret-one/sample/{revision}/view')


def decision(client, revision, **kwargs):
    return client.post(f'/api/takip/secret-one/sample/{revision}/decision', json={'decision': 'approved', 'name': 'Test Müşteri', **kwargs})


def test_publish_does_not_start_clock_until_view_and_view_is_idempotent(env):
    client, db, _ = env
    sample = publish(client).json()['sample']
    assert sample['status'] == 'awaiting_view' and sample['deadline'] is None
    assert client.get('/api/takip/secret-one/sample').json()['sample']['deadline'] is None
    revision = sample['revision']
    assert decision(client, revision).status_code == 409
    sample = view(client, revision).json()['sample']
    assert (datetime.fromisoformat(sample['deadline']) - datetime.fromisoformat(sample['viewed_at'])).total_seconds() == 600
    assert view(client, revision).json()['sample']['deadline'] == sample['deadline']
    assert len(view(client, revision).json()['sample']['events']) == 2


def test_timeout_is_persisted_and_never_customer_approval(env):
    client, db, _ = env
    revision = publish(client).json()['sample']['revision']
    view(client, revision)
    past = (datetime.now(timezone.utc) - timedelta(seconds=1)).isoformat()
    run(db.sample_approvals.update_one({'_id': 'one'}, {'$set': {'deadline': past}}))
    assert decision(client, revision).status_code == 409
    sample = client.get('/api/takip/secret-one/sample').json()['sample']
    assert sample['status'] == 'expired' and not sample['respondent']
    assert run(db.sample_approvals.find_one({'_id': 'one'}))['status'] == 'expired'
    assert len(sample['events']) == 3


def test_strict_approval_has_no_timeout(env):
    client, db, _ = env
    revision = publish(client, strict=True).json()['sample']['revision']
    sample = view(client, revision).json()['sample']
    assert sample['deadline'] is None
    assert decision(client, revision).json()['sample']['status'] == 'approved'
    assert decision(client, revision, decision='changes_requested', note='Düzeltin').status_code == 409


def test_revision_replacement_preserves_history_and_rejects_stale_actions(env):
    client, db, _ = env
    first = publish(client).json()['sample']['revision']
    view(client, first)
    assert decision(client, first, decision='changes_requested', note='Renk koyu').status_code == 200
    second = publish(client, previous=first).json()['sample']
    assert second['status'] == 'awaiting_view' and second['deadline'] is None
    assert second['history'][0]['status'] == 'changes_requested'
    assert second['history'][0]['response_note'] == 'Renk koyu'
    assert decision(client, first).status_code == 409
    assert view(client, first).status_code == 409
    assert publish(client, previous=first).status_code == 409


def test_photo_is_scoped_to_tracking_link_and_normalized(env):
    client, db, _ = env
    revision = publish(client).json()['sample']['revision']
    response = client.get(f'/api/takip/secret-one/sample/{revision}/image')
    assert response.status_code == 200 and response.headers['content-type'] == 'image/jpeg'
    assert Image.open(io.BytesIO(response.content)).format == 'JPEG'
    assert client.get(f'/api/takip/secret-two/sample/{revision}/image').status_code == 404
    assert client.get('/api/takip/invalid/sample').status_code == 404


def test_role_validation_and_bad_images(env):
    client, db, user = env
    user['role'] = 'warehouse'
    assert publish(client).status_code == 403
    assert client.get('/api/jobs/one/sample').status_code == 403
    user['role'] = 'operator'
    assert publish(client, content=b'<svg/>').status_code == 422
    assert publish(client, content=b'x' * (8 * 1024 * 1024 + 1)).status_code == 413
    assert run(db.sample_approvals.count_documents({})) == 0


def test_decision_validation_and_atomic_first_response(env):
    client, db, _ = env
    revision = publish(client).json()['sample']['revision']
    view(client, revision)
    assert decision(client, revision, name='  ').status_code == 422
    assert decision(client, revision, decision='changes_requested', note=' ').status_code == 422
    assert decision(client, revision, decision='expired').status_code == 422
    assert decision(client, revision).status_code == 200
    assert decision(client, revision).status_code == 409
    sample = run(db.sample_approvals.find_one({'_id': 'one'}))
    assert len(sample['events']) == 3 and sample['status'] == 'approved'


def test_worker_expires_without_any_browser_request(env):
    client, db, _ = env
    revision = publish(client).json()['sample']['revision']
    view(client, revision)
    run(db.sample_approvals.update_one({'_id': 'one'}, {'$set': {'deadline': '2000-01-01T00:00:00+00:00'}}))
    async def tick():
        task = asyncio.create_task(samples.expiry_worker())
        await asyncio.sleep(0.02)
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass
        return await db.sample_approvals.find_one({'_id': 'one'})
    assert run(tick())['status'] == 'expired'


def test_release_guard_blocks_unanswered_and_corrections_but_allows_timeout(env):
    client, db, _ = env
    run(samples.require_sample_release('no-sample'))
    revision = publish(client).json()['sample']['revision']
    with pytest.raises(samples.HTTPException) as blocked:
        run(samples.require_sample_release('one'))
    assert blocked.value.status_code == 409
    view(client, revision)
    decision(client, revision, decision='changes_requested', note='Rengi düzeltin')
    with pytest.raises(samples.HTTPException):
        run(samples.require_sample_release('one'))
    revision = publish(client, previous=revision).json()['sample']['revision']
    view(client, revision)
    run(db.sample_approvals.update_one({'_id': 'one'}, {'$set': {'deadline': '2000-01-01T00:00:00+00:00'}}))
    run(samples.require_sample_release('one'))
