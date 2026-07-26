"""
Iteration 47 - "İş Tamamlandı" mükerrer bildirim düzeltmesi.
- PUT /api/jobs/{id}/complete idempotent (already_completed on 2nd/3rd call)
- Chat mesajı hem #plan hem #yonetim kanalına iner ve event_meta.event_key her ikisinde aynı
- Kod incelemesi: services/auto_chat._save_and_broadcast push_dedup, services/notifications.send_notification_to_user_types token dedup mevcut
"""
import os
import re
import time
import uuid
import requests
import pytest

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_USER = "adminusr"
ADMIN_PASS = "admin123"


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{API}/users/login", json={"username": ADMIN_USER, "password": ADMIN_PASS}, timeout=30)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    data = r.json()
    tok = data.get("access_token") or data.get("token")
    assert tok, f"no access token in response: {data}"
    return tok


@pytest.fixture(scope="module")
def headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def a_machine(headers):
    r = requests.get(f"{API}/machines", headers=headers, timeout=15)
    assert r.status_code == 200
    machines = r.json()
    assert machines, "no machines seeded"
    return machines[0]


@pytest.fixture(scope="module")
def created_job(headers, a_machine):
    payload = {
        "name": f"TEST_iter47_{uuid.uuid4().hex[:8]}",
        "koli_count": 5,
        "colors": "test",
        "machine_id": a_machine["id"],
        "machine_name": a_machine.get("name", "M?"),
    }
    r = requests.post(f"{API}/jobs?created_by=TEST", json=payload, headers=headers, timeout=15)
    assert r.status_code == 200, f"job create failed: {r.status_code} {r.text}"
    return r.json()


def test_complete_job_idempotent(headers, created_job):
    """PUT /api/jobs/{id}/complete 3 kez üst üste — ilki 200 tamamlar, 2. ve 3. çağrı already_completed=True."""
    jid = created_job["id"]
    # 1st call
    r1 = requests.put(f"{API}/jobs/{jid}/complete", json={"completed_koli": 5}, headers=headers, timeout=15)
    assert r1.status_code == 200, r1.text
    body1 = r1.json()
    assert body1.get("success") is True
    assert body1.get("already_completed") in (None, False), f"first call must NOT be already_completed: {body1}"

    # 2nd + 3rd calls
    for i in (2, 3):
        r = requests.put(f"{API}/jobs/{jid}/complete", json={"completed_koli": 5}, headers=headers, timeout=15)
        assert r.status_code == 200, f"call {i}: {r.status_code} {r.text}"
        body = r.json()
        assert body.get("already_completed") is True, f"call {i} must return already_completed=True: {body}"


def test_chat_history_has_single_event_key_across_channels(headers, created_job):
    """İş tamamlandıktan sonra #plan ve #yonetim kanallarında 'İş Tamamlandı' mesajı olsun ve event_meta.event_key aynı olsun."""
    # Give background task time to fan out
    time.sleep(3)

    convs = requests.get(f"{API}/chat/conversations", headers=headers, timeout=15).json()
    plan = next((c for c in convs if c.get("channel_key") == "plan"), None)
    yonetim = next((c for c in convs if c.get("channel_key") == "yonetim"), None)
    assert plan and yonetim, f"plan/yonetim channels not found: keys={[c.get('channel_key') for c in convs]}"

    expected_key = f"evt-job_completed-{created_job['id']}"

    def find_msg(conv_id):
        msgs = requests.get(f"{API}/chat/conversations/{conv_id}/messages?limit=50", headers=headers, timeout=15).json()
        for m in msgs:
            meta = m.get("event_meta") or {}
            if meta.get("event_key") == expected_key:
                return m
        return None

    m_plan = find_msg(plan["id"])
    m_yon = find_msg(yonetim["id"])
    assert m_plan is not None, "İş tamamlandı chat mesajı #plan kanalında yok"
    assert m_yon is not None, "İş tamamlandı chat mesajı #yonetim kanalında yok"
    # Both must share the same event_key
    assert m_plan["event_meta"]["event_key"] == m_yon["event_meta"]["event_key"] == expected_key


def test_push_dedup_and_token_dedup_code_present():
    """Backend kod incelemesi: push_dedup set + send_notification_to_user_types token dedup mevcut."""
    ac = open("/app/backend/services/auto_chat.py", encoding="utf-8").read()
    assert "push_dedup" in ac and "push_dedup.update(offline_users)" in ac, \
        "auto_chat._save_and_broadcast push_dedup missing"
    assert "notify_job_completed" in ac and "push_dedup: set = set()" in ac, \
        "notify_job_completed must init a shared push_dedup set"

    nf = open("/app/backend/services/notifications.py", encoding="utf-8").read()
    assert "send_notification_to_user_types" in nf, "send_notification_to_user_types missing"
    # Token dedup with 'seen' set
    assert re.search(r"seen\s*=\s*set\(\)", nf) and "seen.add" in nf, "token dedup (seen set) missing"


def test_jobs_complete_route_has_idempotent_guard():
    src = open("/app/backend/routes/jobs.py", encoding="utf-8").read()
    assert 'already_completed' in src, "complete_job must return already_completed"
    # Order matters: the guard should occur before DB update
    guard_idx = src.find('if job.get("status") == "completed":')
    update_idx = src.find('"status": "completed"')
    assert 0 < guard_idx < update_idx, "idempotent guard must precede status update"
