"""
Iteration 36 Backend tests:
- Login rate-limits raised (CGNAT-friendly) on /api/users/login (120/min),
  /api/management/login (60/min), /api/dashboard/login (60/min).
- Bobin module kg-only refactor (quantity removed) + PATCH /bobins/{id} +
  external machine destinations on to-machine.
"""
import os
import pytest
import requests
import time

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"


# ------------------ Fixtures ------------------

@pytest.fixture(scope="module")
def depo_token():
    r = requests.post(f"{API}/users/login", json={
        "username": "depo1", "password": "depo123", "role": "depo"
    }, timeout=15)
    assert r.status_code == 200, f"depo login failed: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="module")
def auth_headers(depo_token):
    return {"Authorization": f"Bearer {depo_token}"}


# ------------------ Login / Rate Limit ------------------

class TestLogin:
    def test_user_login_success(self):
        r = requests.post(f"{API}/users/login", json={
            "username": "depo1", "password": "depo123", "role": "depo"
        }, timeout=15)
        assert r.status_code == 200
        body = r.json()
        assert "token" in body and isinstance(body["token"], str)
        assert body["username"] == "depo1"

    def test_management_login_wrong_then_right(self):
        bad = requests.post(f"{API}/management/login",
                            json={"password": "wrongpw"}, timeout=15)
        assert bad.status_code == 401

        good = requests.post(f"{API}/management/login",
                             json={"password": "buse11993"}, timeout=15)
        assert good.status_code == 200
        assert good.json().get("success") is True

    def test_dashboard_login_wrong_then_right(self):
        bad = requests.post(f"{API}/dashboard/login",
                            json={"password": "nope"}, timeout=15)
        assert bad.status_code == 401

        good = requests.post(f"{API}/dashboard/login",
                             json={"password": "buse4"}, timeout=15)
        assert good.status_code == 200
        assert good.json().get("success") is True

    def test_user_login_rate_limit_cgnat_friendly(self):
        """30 ardışık başarılı login - 429 olmamalı (limit 120/min)."""
        ok = 0
        rate_limited = 0
        # X-Forwarded-For ile gerçek client IP simülasyonu (CGNAT testi)
        headers = {"X-Forwarded-For": "203.0.113.42"}
        for _ in range(30):
            r = requests.post(f"{API}/users/login", json={
                "username": "depo1", "password": "depo123", "role": "depo"
            }, headers=headers, timeout=15)
            if r.status_code == 200:
                ok += 1
            elif r.status_code == 429:
                rate_limited += 1
        assert rate_limited == 0, f"Got {rate_limited} 429 in 30 reqs"
        assert ok == 30


# ------------------ Bobin CRUD (kg-only) ------------------

class TestBobinKgOnly:
    bobin_id = None

    def test_create_bobin_kg(self, auth_headers):
        suffix = str(int(time.time()))[-5:]
        payload = {
            "brand": f"TestE2E{suffix}",
            "width_cm": 24, "grammage": 17, "color": "Beyaz",
            "total_weight_kg": 100,
            "user_name": "TestDepo"
        }
        r = requests.post(f"{API}/bobins", json=payload,
                          headers=auth_headers, timeout=15)
        assert r.status_code == 200, r.text
        body = r.json()
        assert "bobin" in body
        b = body["bobin"]
        assert b["brand"] == payload["brand"]
        assert b["width_cm"] == 24
        assert b["grammage"] == 17
        assert b["color"] == "Beyaz"
        assert abs(b["total_weight_kg"] - 100) < 0.01
        TestBobinKgOnly.bobin_id = b["id"]

    def test_create_bobin_zero_weight_rejected(self, auth_headers):
        r = requests.post(f"{API}/bobins", json={
            "brand": "ZeroWeight", "width_cm": 20,
            "grammage": 15, "color": "Beyaz",
            "total_weight_kg": 0
        }, headers=auth_headers, timeout=15)
        assert r.status_code == 400
        assert "sifirdan buyuk" in r.json().get("detail", "").lower()

    def test_patch_bobin(self, auth_headers):
        bid = TestBobinKgOnly.bobin_id
        assert bid, "create test must run first"
        r = requests.patch(f"{API}/bobins/{bid}", json={
            "brand": "TestE2E_Updated",
            "total_weight_kg": 120,
            "user_name": "TestDepo"
        }, headers=auth_headers, timeout=15)
        assert r.status_code == 200, r.text
        b = r.json()["bobin"]
        assert b["brand"] == "TestE2E_Updated"
        assert abs(b["total_weight_kg"] - 120) < 0.01

        # GET verify persistence
        g = requests.get(f"{API}/bobins", headers=auth_headers, timeout=15)
        assert g.status_code == 200
        target = next((x for x in g.json() if x["id"] == bid), None)
        assert target is not None
        assert target["brand"] == "TestE2E_Updated"
        assert abs(target["total_weight_kg"] - 120) < 0.01

    def test_purchase_kg(self, auth_headers):
        bid = TestBobinKgOnly.bobin_id
        r = requests.post(f"{API}/bobins/{bid}/purchase", json={
            "weight_kg": 50, "supplier": "TestSup", "user_name": "TestDepo"
        }, headers=auth_headers, timeout=15)
        assert r.status_code == 200, r.text
        assert abs(r.json()["new_weight"] - 170) < 0.01

    def test_to_machine_external_destination(self, auth_headers):
        bid = TestBobinKgOnly.bobin_id
        r = requests.post(f"{API}/bobins/{bid}/to-machine", json={
            "weight_kg": 30,
            "machine_id": "ext-27-makine",
            "machine_name": "27 Makine",
            "user_name": "TestDepo"
        }, headers=auth_headers, timeout=15)
        assert r.status_code == 200, r.text
        assert abs(r.json()["new_weight"] - 140) < 0.01

    def test_sale_kg(self, auth_headers):
        bid = TestBobinKgOnly.bobin_id
        r = requests.post(f"{API}/bobins/{bid}/sale", json={
            "weight_kg": 20, "customer_name": "TestMusteri",
            "user_name": "TestDepo"
        }, headers=auth_headers, timeout=15)
        assert r.status_code == 200, r.text
        assert abs(r.json()["new_weight"] - 120) < 0.01

    def test_movements_listed(self, auth_headers):
        bid = TestBobinKgOnly.bobin_id
        r = requests.get(f"{API}/bobins/movements?bobin_id={bid}",
                         headers=auth_headers, timeout=15)
        assert r.status_code == 200
        movs = r.json()
        assert len(movs) >= 4  # create + purchase + to_machine + sale
        types = [m["movement_type"] for m in movs]
        assert "purchase" in types
        assert "to_machine" in types
        assert "sale" in types
        # External machine present
        ext = [m for m in movs if m.get("machine_id") == "ext-27-makine"]
        assert len(ext) >= 1
        assert ext[0]["machine_name"] == "27 Makine"
        assert ext[0]["weight_kg"] == 30
        # All movements should have weight_kg field
        for m in movs:
            assert "weight_kg" in m

    def test_export_xlsx(self, auth_headers):
        r = requests.get(f"{API}/bobins/export",
                         headers=auth_headers, timeout=30)
        assert r.status_code == 200
        ct = r.headers.get("content-type", "")
        assert "spreadsheetml" in ct or "xlsx" in r.headers.get("content-disposition", "")
        # XLSX magic bytes (PK)
        assert r.content[:2] == b"PK"

    def test_delete_blocked_when_weight(self, auth_headers):
        bid = TestBobinKgOnly.bobin_id
        r = requests.delete(f"{API}/bobins/{bid}",
                            json={"user_name": "TestDepo"},
                            headers=auth_headers, timeout=15)
        assert r.status_code == 400
        assert "agirlik" in r.json().get("detail", "").lower() or \
               "stok" in r.json().get("detail", "").lower()

    def test_delete_after_zeroing(self, auth_headers):
        bid = TestBobinKgOnly.bobin_id
        # zero out via PATCH
        r = requests.patch(f"{API}/bobins/{bid}",
                           json={"total_weight_kg": 0, "user_name": "TestDepo"},
                           headers=auth_headers, timeout=15)
        assert r.status_code == 200
        # now delete
        d = requests.delete(f"{API}/bobins/{bid}",
                            json={"user_name": "TestDepo"},
                            headers=auth_headers, timeout=15)
        assert d.status_code == 200
        # GET must not return it
        g = requests.get(f"{API}/bobins", headers=auth_headers, timeout=15)
        ids = [x["id"] for x in g.json()]
        assert bid not in ids
