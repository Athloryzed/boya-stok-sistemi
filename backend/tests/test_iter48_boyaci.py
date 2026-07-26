"""
Iteration 48 — Yeni 'boyaci' rolü + /boyaci paneli akışları için backend testleri.
Kapsam:
  - Boyacı kullanıcı login (var olan boyaci1 / boya123)
  - POST /api/users ile roles=['boyaci'] oluşturma (admin token)
  - Sıralama batch endpoint'i (reorder-batch) — boyaci token ile de çalışıyor mu
  - Start/Complete job akışı boyaci token ile çalışıyor
  - VALID_ROLES/ALL_PANEL_ROLES 'boyaci' içeriyor
"""
import os
import uuid
import pytest
import requests

_env_url = os.environ.get("REACT_APP_BACKEND_URL")
if not _env_url:
    # read frontend .env
    try:
        with open("/app/frontend/.env") as _f:
            for _line in _f:
                if _line.startswith("REACT_APP_BACKEND_URL="):
                    _env_url = _line.split("=", 1)[1].strip()
                    break
    except Exception:
        pass
BASE_URL = (_env_url or "").rstrip("/")
API = f"{BASE_URL}/api"


def _login(username: str, password: str):
    r = requests.post(f"{API}/users/login", json={"username": username, "password": password}, timeout=15)
    return r


@pytest.fixture(scope="module")
def admin_token():
    r = _login("adminusr", "admin123")
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text[:200]}"
    return r.json().get("access_token") or r.json().get("token")


@pytest.fixture(scope="module")
def boyaci_token():
    r = _login("boyaci1", "boya123")
    assert r.status_code == 200, f"boyaci login failed: {r.status_code} {r.text[:200]}"
    js = r.json()
    tok = js.get("access_token") or js.get("token")
    # rol içeriği doğrula
    roles = js.get("roles") or [js.get("role") or js.get("login_role")]
    assert any("boyaci" in (r_ or "").lower() for r_ in roles) or js.get("login_role") == "boyaci", \
        f"boyaci role missing in login response: {js}"
    return tok


# ─── 1. Boyacı login çalışıyor ─────────────────────────────────────────────
def test_boyaci_login_returns_token(boyaci_token):
    assert boyaci_token and isinstance(boyaci_token, str) and len(boyaci_token) > 10


# ─── 2. Admin, POST /users ile roles=['boyaci'] kullanıcı oluşturabiliyor ──
def test_admin_can_create_boyaci_user(admin_token):
    h = {"Authorization": f"Bearer {admin_token}"}
    uname = f"TEST_boyaci_{uuid.uuid4().hex[:6]}"
    payload = {
        "username": uname,
        "password": "test1234",
        "display_name": "TEST Boyaci",
        "roles": ["boyaci"],
    }
    r = requests.post(f"{API}/users", json=payload, headers=h, timeout=15)
    assert r.status_code in (200, 201), f"create user failed: {r.status_code} {r.text[:200]}"
    body = r.json()
    user_id = body.get("id")
    assert user_id, f"no id in response: {body}"
    roles = body.get("roles") or [body.get("role")]
    assert "boyaci" in roles, f"boyaci role missing: {roles}"

    # login ile doğrula
    lr = _login(uname, "test1234")
    assert lr.status_code == 200, f"new user login failed: {lr.status_code} {lr.text[:200]}"

    # cleanup
    requests.delete(f"{API}/users/{user_id}", headers=h, timeout=15)


# ─── 3. Boyaci token /api/jobs & /machines & /users?role=operator okuyabiliyor ─
def test_boyaci_can_read_core_endpoints(boyaci_token):
    h = {"Authorization": f"Bearer {boyaci_token}"}
    for path in ["/jobs", "/machines", "/users?role=operator", "/jobs/expected-summary"]:
        r = requests.get(f"{API}{path}", headers=h, timeout=15)
        assert r.status_code == 200, f"GET {path} failed: {r.status_code} {r.text[:200]}"


# ─── 4. Reorder-batch — Boyacı sıralaması TÜM panellere yansıyor ──────────
@pytest.fixture(scope="module")
def test_jobs(admin_token):
    """3 pending TEST işi oluştur — testler bittiğinde temizle."""
    h = {"Authorization": f"Bearer {admin_token}"}
    m_r = requests.get(f"{API}/machines", headers=h, timeout=15)
    assert m_r.status_code == 200
    machines = m_r.json()
    if not machines:
        pytest.skip("No machines available")
    machine = machines[0]

    created = []
    for i in range(3):
        payload = {
            "name": f"TEST_ITER48_JOB_{i}_{uuid.uuid4().hex[:6]}",
            "machine_id": machine["id"],
            "machine_name": machine["name"],
            "koli_count": 10,
            "customer_name": "TEST Musteri",
            "colors": "kirmizi",
            "notes": f"iter48 test job {i}",
        }
        r = requests.post(f"{API}/jobs", json=payload, headers=h, timeout=15)
        assert r.status_code in (200, 201), f"create job failed: {r.status_code} {r.text[:200]}"
        created.append(r.json())
    yield created
    # cleanup
    for j in created:
        try:
            requests.delete(f"{API}/jobs/{j['id']}", headers=h, timeout=15)
        except Exception:
            pass


def test_reorder_batch_with_boyaci_token_persists(boyaci_token, test_jobs):
    h = {"Authorization": f"Bearer {boyaci_token}"}
    # ters sıra: sondaki iş 0. sıraya
    reversed_jobs = list(reversed(test_jobs))
    payload = {"jobs": [{"job_id": j["id"], "order": idx} for idx, j in enumerate(reversed_jobs)]}
    r = requests.put(f"{API}/jobs/reorder-batch", json=payload, headers=h, timeout=15)
    assert r.status_code == 200, f"reorder-batch failed: {r.status_code} {r.text[:200]}"

    # GET ile doğrula — order değerleri persist etti mi
    gr = requests.get(f"{API}/jobs", headers=h, timeout=15)
    assert gr.status_code == 200
    all_jobs = {j["id"]: j for j in gr.json()}
    for idx, j in enumerate(reversed_jobs):
        assert all_jobs[j["id"]].get("order") == idx, \
            f"order not persisted for {j['id']}: expected {idx}, got {all_jobs[j['id']].get('order')}"


# ─── 5. Start & Complete akışı boyaci token ile ────────────────────────────
def test_boyaci_can_start_and_complete_job(boyaci_token, test_jobs):
    h = {"Authorization": f"Bearer {boyaci_token}"}
    job = test_jobs[0]

    # Start
    sr = requests.put(f"{API}/jobs/{job['id']}/start",
                      json={"operator_name": "TEST_OP"}, headers=h, timeout=15)
    assert sr.status_code == 200, f"start failed: {sr.status_code} {sr.text[:200]}"

    # Verify persistence
    gr = requests.get(f"{API}/jobs", headers=h, timeout=15).json()
    started = next((j for j in gr if j["id"] == job["id"]), None)
    assert started and started["status"] == "in_progress"
    assert started.get("operator_name") == "TEST_OP"

    # Complete
    cr = requests.put(f"{API}/jobs/{job['id']}/complete", json={}, headers=h, timeout=15)
    assert cr.status_code == 200, f"complete failed: {cr.status_code} {cr.text[:200]}"

    gr2 = requests.get(f"{API}/jobs", headers=h, timeout=15).json()
    completed = next((j for j in gr2 if j["id"] == job["id"]), None)
    assert completed and completed["status"] == "completed"


# ─── 6. Regresyon — Plan/operator akışı hâlâ çalışıyor ─────────────────────
def test_regression_plan_user_still_works():
    r = _login("emrecan", "testtest12")
    assert r.status_code == 200
    tok = r.json().get("access_token") or r.json().get("token")
    h = {"Authorization": f"Bearer {tok}"}
    for path in ["/jobs", "/machines", "/jobs/expected-summary"]:
        rr = requests.get(f"{API}{path}", headers=h, timeout=15)
        assert rr.status_code == 200, f"regression fail {path}: {rr.status_code}"
