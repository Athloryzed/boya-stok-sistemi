"""
Iteration 37 (test report iter 37) — Payload optimization & atomic bobin
deduction & recalculate endpoint regression tests.

Covers:
- GET /api/jobs returns image_url=None & has_image flag
- GET /api/jobs/{id}/image lazy load endpoint (200 + 401)
- POST /api/bobins/{id}/to-machine atomic decrement (1947 - 970 = 977)
- POST /api/bobins/{id}/to-machine insufficient stock 400
- POST /api/bobins/{id}/sale atomic decrement
- POST /api/admin/bobins/recalculate fixes corrupted weight
- GET /api/visitors limit 50, user_agent not in payload
- GET /api/dashboard/live payload has no image_url anywhere
- Backup endpoint Python fallback (mongodump-less env)
"""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL').rstrip('/')


# -------------------- Fixtures --------------------
@pytest.fixture(scope="session")
def mgmt_token():
    """Yonetim login token via /api/management/login."""
    r = requests.post(f"{BASE_URL}/api/management/login", json={"password": "buse11993"}, timeout=15)
    if r.status_code != 200:
        pytest.skip(f"Management login failed: {r.status_code} {r.text}")
    return r.json().get("token")


@pytest.fixture(scope="session")
def depo_token():
    """Depo user login for bobin CRUD."""
    r = requests.post(f"{BASE_URL}/api/users/login",
                      json={"username": "depo1", "password": "depo123"}, timeout=15)
    if r.status_code != 200:
        pytest.skip(f"Depo login failed: {r.status_code} {r.text}")
    return r.json().get("token")


@pytest.fixture(scope="session")
def dash_token():
    r = requests.post(f"{BASE_URL}/api/dashboard/login", json={"password": "buse4"}, timeout=15)
    if r.status_code != 200:
        pytest.skip("Dashboard login failed")
    return r.json().get("token")


def _h(tok):
    return {"Authorization": f"Bearer {tok}"}


# -------------------- Jobs payload optimisation --------------------
class TestJobsPayload:
    def test_jobs_list_no_image_url_has_flag(self, mgmt_token):
        r = requests.get(f"{BASE_URL}/api/jobs", headers=_h(mgmt_token), timeout=15)
        assert r.status_code == 200, r.text
        jobs = r.json()
        assert isinstance(jobs, list)
        if not jobs:
            pytest.skip("No jobs in DB")
        for j in jobs[:50]:
            # image_url should be None/absent in list (Pydantic returns None)
            assert j.get("image_url") in (None, ""), f"image_url leaked: {j.get('id')}"
            # has_image flag must be present
            assert "has_image" in j, f"has_image missing on {j.get('id')}"
            assert isinstance(j["has_image"], bool)

    def test_get_job_image_lazy_endpoint_200(self, mgmt_token):
        # Create a job to retrieve image (without image)
        payload = {
            "name": f"TEST_IMG_{int(time.time())}",
            "koli_count": 1, "colors": "test",
            "machine_id": "test-m", "machine_name": "Test Makine",
        }
        cr = requests.post(f"{BASE_URL}/api/jobs", json=payload, headers=_h(mgmt_token), timeout=15)
        assert cr.status_code == 200, cr.text
        jid = cr.json()["id"]
        try:
            ir = requests.get(f"{BASE_URL}/api/jobs/{jid}/image", headers=_h(mgmt_token), timeout=15)
            assert ir.status_code == 200, ir.text
            data = ir.json()
            assert data.get("id") == jid
            assert "image_url" in data
        finally:
            requests.delete(f"{BASE_URL}/api/jobs/{jid}", headers=_h(mgmt_token), timeout=15)

    def test_get_job_image_unauthorized(self):
        r = requests.get(f"{BASE_URL}/api/jobs/anyid/image", timeout=15)
        assert r.status_code in (401, 403), f"Expected 401/403, got {r.status_code}"


# -------------------- Bobin atomic decrement & recalculate --------------------
class TestBobinAtomic:
    @pytest.fixture
    def fresh_bobin(self, depo_token):
        """Create a TEST bobin with 1947 kg."""
        ts = int(time.time())
        payload = {
            "brand": f"TEST_ATOM_{ts}", "width_cm": 33.0, "grammage": 28.0,
            "color": "Beyaz", "layers": 2, "quantity": 0,
            "total_weight_kg": 1947.0,
            "supplier": "Test", "user_name": "TestRunner"
        }
        r = requests.post(f"{BASE_URL}/api/bobins", json=payload, headers=_h(depo_token), timeout=15)
        assert r.status_code == 200, r.text
        bid = r.json()["bobin"]["id"]
        yield bid
        # cleanup: zero-out & delete
        try:
            cur = requests.get(f"{BASE_URL}/api/bobins", headers=_h(depo_token), timeout=15).json()
            mine = next((b for b in cur if b.get("id") == bid), None)
            if mine and mine.get("total_weight_kg", 0) > 0:
                requests.post(f"{BASE_URL}/api/bobins/{bid}/to-machine",
                              json={"weight_kg": mine["total_weight_kg"], "machine_id": "x", "machine_name": "Cleanup", "user_name": "TestRunner"},
                              headers=_h(depo_token), timeout=15)
            requests.delete(f"{BASE_URL}/api/bobins/{bid}",
                            json={"user_name": "TestRunner"}, headers=_h(depo_token), timeout=15)
        except Exception:
            pass

    def test_to_machine_atomic_decrement_1947_minus_970(self, depo_token, fresh_bobin):
        r = requests.post(f"{BASE_URL}/api/bobins/{fresh_bobin}/to-machine",
                          json={"weight_kg": 970.0, "machine_id": "m1", "machine_name": "Makine 1", "user_name": "TestRunner"},
                          headers=_h(depo_token), timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "new_weight" in data
        assert abs(data["new_weight"] - 977.0) < 0.01, f"Expected 977kg, got {data['new_weight']}"

    def test_to_machine_insufficient_stock_400(self, depo_token, fresh_bobin):
        r = requests.post(f"{BASE_URL}/api/bobins/{fresh_bobin}/to-machine",
                          json={"weight_kg": 999999.0, "machine_id": "m1", "machine_name": "Makine 1", "user_name": "TestRunner"},
                          headers=_h(depo_token), timeout=15)
        assert r.status_code == 400, r.text
        assert "Yetersiz" in r.text or "stok" in r.text.lower()

    def test_sale_atomic_decrement(self, depo_token, fresh_bobin):
        r = requests.post(f"{BASE_URL}/api/bobins/{fresh_bobin}/sale",
                          json={"weight_kg": 500.0, "customer_name": "TestMusteri", "user_name": "TestRunner"},
                          headers=_h(depo_token), timeout=15)
        assert r.status_code == 200, r.text
        # Confirm decrement: 1947 - 500 = 1447
        assert abs(r.json().get("new_weight", 0) - 1447.0) < 0.01

    def test_recalculate_fixes_corrupted_weight(self, depo_token, mgmt_token, fresh_bobin):
        # Corrupt the bobin weight via PATCH (raw edit)
        pr = requests.patch(f"{BASE_URL}/api/bobins/{fresh_bobin}",
                            json={"total_weight_kg": 9999.0, "user_name": "TestRunner"},
                            headers=_h(depo_token), timeout=15)
        assert pr.status_code == 200, pr.text
        # Recalculate (yonetim only)
        rr = requests.post(f"{BASE_URL}/api/admin/bobins/recalculate",
                           headers=_h(mgmt_token), timeout=30)
        assert rr.status_code == 200, rr.text
        body = rr.json()
        assert body.get("success") is True
        assert "fixed_count" in body
        assert "fixed" in body
        # Our bobin should be fixed back to ~1947 (only purchase movement)
        fixed_ids = [f["id"] for f in body["fixed"]]
        assert fresh_bobin in fixed_ids, "Corrupted bobin should be in fixed[]"
        my_fix = next(f for f in body["fixed"] if f["id"] == fresh_bobin)
        assert abs(my_fix["new_weight_kg"] - 1947.0) < 0.01


# -------------------- Visitors payload --------------------
class TestVisitorsPayload:
    def test_visitors_default_limit_50_no_user_agent(self, mgmt_token):
        r = requests.get(f"{BASE_URL}/api/visitors", headers=_h(mgmt_token), timeout=15)
        assert r.status_code == 200
        visitors = r.json()
        assert isinstance(visitors, list)
        assert len(visitors) <= 50
        for v in visitors:
            assert "user_agent" not in v, "user_agent should be excluded"


# -------------------- Dashboard payload --------------------
class TestDashboardPayload:
    def test_dashboard_live_no_image_url(self, dash_token):
        r = requests.get(f"{BASE_URL}/api/dashboard/live", headers=_h(dash_token), timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        # Recursively scan for image_url with base64
        def _scan(obj):
            if isinstance(obj, dict):
                for k, v in obj.items():
                    if k == "image_url" and isinstance(v, str) and v.startswith("data:image"):
                        return True
                    if _scan(v):
                        return True
            elif isinstance(obj, list):
                return any(_scan(x) for x in obj)
            return False
        assert not _scan(data), "Dashboard live should NOT include base64 image_url"


# -------------------- Backup endpoint Python fallback --------------------
class TestBackup:
    def test_backup_list(self, mgmt_token):
        r = requests.get(f"{BASE_URL}/api/admin/backups", headers=_h(mgmt_token), timeout=15)
        assert r.status_code == 200, r.text
        body = r.json()
        assert "backups" in body
        assert isinstance(body["backups"], list)

    def test_backup_run_python_fallback(self, mgmt_token):
        """Backup run; whether mongodump or python fallback, must return success."""
        r = requests.post(f"{BASE_URL}/api/admin/backups/run", headers=_h(mgmt_token), timeout=120)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("success") is True
        assert body.get("method") in ("mongodump", "python_bson")
        assert body.get("filename", "").startswith("backup_")
        # Cleanup the freshly created backup
        try:
            requests.delete(f"{BASE_URL}/api/admin/backups/{body['filename']}", headers=_h(mgmt_token), timeout=10)
        except Exception:
            pass
