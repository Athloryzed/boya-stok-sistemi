"""
Iteration 52: Notification guard / dedup tests
- notification_guard.claim_users atomicity
- register_fcm_token addToSet user_types
- complete_job endpoint returns 200 + idempotent
- FCM/webpush cross-channel dedup via notification_receipts
- Stale FCM token cleanup
- Chat message posted to BOTH channels (yonetim + plan) on job complete
- notify_maintenance_request multi-channel dedup

Uses sync pymongo for DB checks (motor loop conflicts across asyncio.run() calls).
"""
import os
import sys
import time
import uuid
import asyncio
import pytest
import requests
from datetime import datetime, timezone, timedelta
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")
load_dotenv("/app/frontend/.env")

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
API = f"{BASE_URL}/api"

MONGO_URL = os.environ.get("MONGO_URL")
DB_NAME = os.environ.get("DB_NAME")
assert BASE_URL and MONGO_URL and DB_NAME, "env not loaded"

sys.path.insert(0, "/app/backend")


@pytest.fixture(scope="session")
def mdb():
    client = MongoClient(MONGO_URL)
    yield client[DB_NAME]
    client.close()


@pytest.fixture(scope="session")
def admin_token():
    for path in ("/users/login", "/auth/login"):
        r = requests.post(f"{API}{path}", json={"username": "adminusr", "password": "admin123"}, timeout=15)
        if r.status_code == 200:
            data = r.json()
            tok = data.get("access_token") or data.get("token")
            if tok:
                return tok
    pytest.fail(f"login failed: {r.status_code} {r.text[:200]}")


@pytest.fixture(scope="session")
def h(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


_LOOP = asyncio.new_event_loop()


def _run(coro):
    """Single shared loop for the whole test session (motor client binds to it)."""
    return _LOOP.run_until_complete(coro)


# ── 1) notification_guard.claim_users ─────────────────────────────────────
def test_claim_users_atomicity(mdb):
    event_key = f"TEST-evt-{uuid.uuid4().hex[:8]}"
    users_a = ["userA", "userB", "userC"]
    users_b = ["userB", "userC", "userD"]

    async def run():
        # import inside the loop
        from services.notification_guard import claim_users
        first = await claim_users(event_key, users_a)
        second = await claim_users(event_key, users_b)
        return first, second

    first, second = _run(run())
    cnt = mdb.notification_receipts.count_documents({"event_key": event_key})
    mdb.notification_receipts.delete_many({"event_key": event_key})

    assert set(first) == {"userA", "userB", "userC"}, f"first={first}"
    assert set(second) == {"userD"}, f"second={second}"
    assert cnt == 4, f"expected 4, got {cnt}"


def test_claim_users_empty_inputs():
    async def run():
        from services.notification_guard import claim_users
        return await claim_users("", ["a"]), await claim_users("k", [])
    r1, r2 = _run(run())
    assert r1 == ["a"]
    assert r2 == []


# ── 2) register_fcm_token $addToSet user_types ────────────────────────────
def test_register_token_addtoset_user_types(h, mdb):
    token = f"TEST_TOKEN_{uuid.uuid4().hex}"
    r = requests.post(f"{API}/notifications/register-token",
                      json={"token": token, "user_type": "manager", "user_id": "TEST_user1"},
                      headers=h, timeout=10)
    assert r.status_code == 200, r.text
    r = requests.post(f"{API}/notifications/register-token",
                      json={"token": token, "user_type": "plan", "user_id": "TEST_user1"},
                      headers=h, timeout=10)
    assert r.status_code == 200

    doc = mdb.fcm_tokens.find_one({"token": token})
    assert doc, "token doc missing"
    assert set(doc.get("user_types") or []) == {"manager", "plan"}, doc
    assert mdb.fcm_tokens.count_documents({"token": token}) == 1
    mdb.fcm_tokens.delete_one({"token": token})


# ── 3) GET /api/jobs works with auth ──────────────────────────────────────
def test_get_jobs_authenticated(h):
    r = requests.get(f"{API}/jobs", headers=h, timeout=15)
    assert r.status_code == 200, r.text
    assert isinstance(r.json(), list)


# ── 4) Create + complete job idempotent + chat posted to BOTH channels ────
def test_create_complete_job_chat_broadcast(h, mdb):
    machines = requests.get(f"{API}/machines", headers=h, timeout=10).json()
    assert machines
    m = machines[0]

    payload = {
        "id": str(uuid.uuid4()),
        "name": f"TEST_JOB_{uuid.uuid4().hex[:6]}",
        "koli_count": 5, "colors": "TEST",
        "machine_id": m["id"], "machine_name": m.get("name", "M"),
    }
    r = requests.post(f"{API}/jobs?created_by=Plan", headers=h, json=payload, timeout=15)
    assert r.status_code == 200, f"create job: {r.status_code} {r.text[:300]}"
    job_id = r.json()["id"]

    r = requests.put(f"{API}/jobs/{job_id}/complete", headers=h, json={"completed_koli": 5}, timeout=15)
    assert r.status_code == 200
    assert r.json().get("success") is True

    r2 = requests.put(f"{API}/jobs/{job_id}/complete", headers=h, json={"completed_koli": 5}, timeout=15)
    assert r2.status_code == 200
    assert r2.json().get("already_completed") is True

    time.sleep(4.0)  # background task
    event_tag = f"evt-job_completed-{job_id}"

    plan_conv = mdb.conversations.find_one({"channel_key": "plan"})
    yon_conv = mdb.conversations.find_one({"channel_key": "yonetim"})
    assert plan_conv and yon_conv, "seed channels missing"

    plan_msg = mdb.chat_messages.find_one({
        "conversation_id": plan_conv["id"],
        "event_type": "job_completed",
        "event_meta.job_id": job_id,
    })
    yon_msg = mdb.chat_messages.find_one({
        "conversation_id": yon_conv["id"],
        "event_type": "job_completed",
        "event_meta.job_id": job_id,
    })
    receipts = list(mdb.notification_receipts.find({"event_key": event_tag}))

    # Cleanup
    mdb.notification_receipts.delete_many({"event_key": event_tag})
    mdb.jobs.delete_one({"id": job_id})
    if plan_msg:
        mdb.chat_messages.delete_one({"id": plan_msg["id"]})
    if yon_msg:
        mdb.chat_messages.delete_one({"id": yon_msg["id"]})

    assert plan_msg is not None, "chat message NOT posted to #plan channel"
    assert yon_msg is not None, "chat message NOT posted to #yonetim channel"

    users = [r_["user_id"] for r_ in receipts]
    assert len(users) == len(set(users)), f"duplicate receipts: {users}"


# ── 5) Stale FCM token cleanup ────────────────────────────────────────────
def test_stale_fcm_token_cleanup(h, mdb):
    fake_token = f"fake_test_token_{uuid.uuid4().hex}"
    mdb.fcm_tokens.insert_one({
        "token": fake_token, "user_type": "manager",
        "user_types": ["manager"], "user_id": "TEST_stale_user",
        "updated_at": datetime.now(timezone.utc).isoformat(),
    })

    machines = requests.get(f"{API}/machines", headers=h, timeout=10).json()
    m = machines[0]
    payload = {
        "id": str(uuid.uuid4()),
        "name": f"TEST_JOB_STALE_{uuid.uuid4().hex[:6]}",
        "koli_count": 1, "colors": "T",
        "machine_id": m["id"], "machine_name": m.get("name", "M"),
    }
    r = requests.post(f"{API}/jobs?created_by=Plan", headers=h, json=payload, timeout=15)
    job_id = r.json()["id"]
    r = requests.put(f"{API}/jobs/{job_id}/complete", headers=h, json={"completed_koli": 1}, timeout=15)
    assert r.status_code == 200

    time.sleep(6.0)  # background FCM send + cleanup

    doc = mdb.fcm_tokens.find_one({"token": fake_token})
    # cleanup
    mdb.fcm_tokens.delete_one({"token": fake_token})
    mdb.jobs.delete_one({"id": job_id})
    mdb.notification_receipts.delete_many({"event_key": f"evt-job_completed-{job_id}"})

    assert doc is None, "stale FCM token was NOT cleaned up (Firebase send should have flagged it invalid)"


# ── 6) notify_maintenance_request multi-channel dedup ─────────────────────
def test_maintenance_multichannel_dedup(mdb):
    """Same user in BOTH #yonetim and #plan channels; should be claimed only ONCE
    per event, but chat message must appear in BOTH channels."""
    test_user = f"TEST_multi_user_{uuid.uuid4().hex[:6]}"
    for ch_key in ("yonetim", "plan"):
        mdb.conversations.update_one(
            {"channel_key": ch_key}, {"$addToSet": {"participants": test_user}}
        )
    m = mdb.machines.find_one({})
    assert m, "no machines"
    cutoff = (datetime.now(timezone.utc) - timedelta(seconds=2)).isoformat()

    async def run():
        from services import auto_chat
        await auto_chat.notify_maintenance_request(
            operator_name="TEST_op",
            machine_name=m.get("name", "M"),
            machine_id=m["id"],
            note="pytest dedup",
        )
    _run(run())

    time.sleep(0.5)
    recs = list(mdb.notification_receipts.find({"user_id": test_user}))
    plan = mdb.conversations.find_one({"channel_key": "plan"})
    yon = mdb.conversations.find_one({"channel_key": "yonetim"})
    plan_cnt = mdb.chat_messages.count_documents({
        "conversation_id": plan["id"], "event_type": "maintenance_request",
        "created_at": {"$gte": cutoff}, "event_meta.operator_name": "TEST_op",
    })
    yon_cnt = mdb.chat_messages.count_documents({
        "conversation_id": yon["id"], "event_type": "maintenance_request",
        "created_at": {"$gte": cutoff}, "event_meta.operator_name": "TEST_op",
    })

    # Cleanup
    for ch_key in ("yonetim", "plan"):
        mdb.conversations.update_one({"channel_key": ch_key}, {"$pull": {"participants": test_user}})
    event_keys = list({r["event_key"] for r in recs})
    if event_keys:
        mdb.notification_receipts.delete_many({"event_key": {"$in": event_keys}})
    mdb.chat_messages.delete_many({
        "event_type": "maintenance_request",
        "created_at": {"$gte": cutoff},
        "event_meta.operator_name": "TEST_op",
    })

    assert len(recs) == 1, f"expected 1 receipt (dedup), got {len(recs)}: {recs}"
    assert plan_cnt >= 1, "maintenance message missing in #plan"
    assert yon_cnt >= 1, "maintenance message missing in #yonetim"
