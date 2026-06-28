"""
Backend tests for Multi-Warehouse (Depo1/Depo2) Assignment System.
Endpoints under test:
  - GET  /api/warehouse-summary
  - POST /api/warehouse-transfer
  - GET  /api/warehouse-transfers
  - POST /api/bobins (with warehouse)
  - POST /api/brand-stock (with warehouse)
"""
import os
import pytest
import requests
import uuid

# Load REACT_APP_BACKEND_URL from frontend .env if not set in environment
def _load_base_url():
    v = os.environ.get("REACT_APP_BACKEND_URL")
    if v:
        return v.rstrip("/")
    try:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    return line.split("=", 1)[1].strip().rstrip("/")
    except Exception:
        pass
    raise RuntimeError("REACT_APP_BACKEND_URL not configured")

BASE_URL = _load_base_url()
ADMIN_USER = "adminusr"
ADMIN_PASS = "admin123"


@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{BASE_URL}/api/users/login", json={
        "username": ADMIN_USER, "password": ADMIN_PASS, "role": "yonetim"
    }, timeout=20)
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    tok = r.json().get("token") or r.json().get("access_token")
    assert tok, f"No token in response: {r.json()}"
    return tok


@pytest.fixture(scope="module")
def hdr(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def seed_bobin(hdr):
    payload = {
        "brand": f"TESTWH_{uuid.uuid4().hex[:6]}",
        "width_cm": 70, "grammage": 32, "color": "Beyaz", "layers": 1,
        "quantity": 1, "total_weight_kg": 100, "supplier": "TEST",
        "user_name": "pytest",
    }
    r = requests.post(f"{BASE_URL}/api/bobins", json=payload, headers=hdr, timeout=20)
    assert r.status_code == 200, f"Create bobin failed: {r.text}"
    return r.json()["bobin"]["id"]


@pytest.fixture(scope="module")
def seed_marka(hdr):
    payload = {
        "brand": f"TESTWHM_{uuid.uuid4().hex[:6]}",
        "machine": "ICM", "color": "", "quantity": 25,
        "user_name": "pytest",
    }
    r = requests.post(f"{BASE_URL}/api/brand-stock", json=payload, headers=hdr, timeout=20)
    assert r.status_code == 200, f"Create marka failed: {r.text}"
    return r.json()["stock"]["id"]


# ============ /api/warehouse-summary ============

def test_warehouse_summary_structure(hdr):
    r = requests.get(f"{BASE_URL}/api/warehouse-summary", headers=hdr, timeout=15)
    assert r.status_code == 200, r.text
    data = r.json()
    for w in ("DEPO1", "DEPO2", "UNASSIGNED"):
        assert w in data, f"Missing {w} in summary: {list(data.keys())}"
        for k in ("bobin_count", "bobin_critical", "marka_stok_count", "marka_stok_critical"):
            assert k in data[w], f"Missing {k} in {w}: {data[w]}"
            assert isinstance(data[w][k], int)


def test_warehouse_summary_requires_auth():
    r = requests.get(f"{BASE_URL}/api/warehouse-summary", timeout=15)
    assert r.status_code in (401, 403), f"Expected 401/403, got {r.status_code}"


# ============ /api/warehouse-transfer ============

def test_transfer_bobin_to_depo1(hdr, seed_bobin):
    r = requests.post(f"{BASE_URL}/api/warehouse-transfer", headers=hdr, json={
        "item_type": "bobin", "item_id": seed_bobin, "to_warehouse": "DEPO1"
    }, timeout=15)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body.get("ok") is True
    log = body.get("log") or {}
    assert log.get("to_warehouse") == "DEPO1"
    assert log.get("item_type") == "bobin"
    # item_name format "Marka 70cm 32gr Beyaz"
    name = log.get("item_name") or ""
    assert "cm" in name and "gr" in name, f"Bad item_name format: {name}"


def test_transfer_marka_to_depo2(hdr, seed_marka):
    r = requests.post(f"{BASE_URL}/api/warehouse-transfer", headers=hdr, json={
        "item_type": "marka_stok", "item_id": seed_marka, "to_warehouse": "DEPO2"
    }, timeout=15)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body.get("ok") is True
    assert body["log"]["to_warehouse"] == "DEPO2"
    assert body["log"]["item_type"] == "marka_stok"


def test_transfer_to_unassigned_empty_string(hdr, seed_bobin):
    # First send to DEPO2 to ensure state changes
    requests.post(f"{BASE_URL}/api/warehouse-transfer", headers=hdr, json={
        "item_type": "bobin", "item_id": seed_bobin, "to_warehouse": "DEPO2"
    }, timeout=15)
    # Now unassign (empty)
    r = requests.post(f"{BASE_URL}/api/warehouse-transfer", headers=hdr, json={
        "item_type": "bobin", "item_id": seed_bobin, "to_warehouse": ""
    }, timeout=15)
    assert r.status_code == 200, r.text
    body = r.json()
    if body.get("no_change"):
        pytest.skip("Already unassigned")
    assert body["log"]["to_warehouse"] in (None, "")


def test_transfer_invalid_warehouse(hdr, seed_bobin):
    r = requests.post(f"{BASE_URL}/api/warehouse-transfer", headers=hdr, json={
        "item_type": "bobin", "item_id": seed_bobin, "to_warehouse": "DEPO99"
    }, timeout=15)
    assert r.status_code == 400


def test_transfer_invalid_item_type(hdr, seed_bobin):
    r = requests.post(f"{BASE_URL}/api/warehouse-transfer", headers=hdr, json={
        "item_type": "garbage", "item_id": seed_bobin, "to_warehouse": "DEPO1"
    }, timeout=15)
    assert r.status_code == 400


def test_transfer_unknown_item(hdr):
    r = requests.post(f"{BASE_URL}/api/warehouse-transfer", headers=hdr, json={
        "item_type": "bobin", "item_id": "nonexistent-id-xyz", "to_warehouse": "DEPO1"
    }, timeout=15)
    assert r.status_code == 404


# ============ /api/warehouse-transfers (list) ============

def test_list_transfers_basic(hdr):
    r = requests.get(f"{BASE_URL}/api/warehouse-transfers?limit=10", headers=hdr, timeout=15)
    assert r.status_code == 200, r.text
    data = r.json()
    assert isinstance(data, list)


def test_list_transfers_filter_bobin_depo1(hdr, seed_bobin):
    # Ensure at least one log to DEPO1
    requests.post(f"{BASE_URL}/api/warehouse-transfer", headers=hdr, json={
        "item_type": "bobin", "item_id": seed_bobin, "to_warehouse": "DEPO1"
    }, timeout=15)
    r = requests.get(
        f"{BASE_URL}/api/warehouse-transfers?limit=20&item_type=bobin&warehouse=DEPO1",
        headers=hdr, timeout=15
    )
    assert r.status_code == 200
    data = r.json()
    for log in data:
        assert log["item_type"] == "bobin"
        assert log.get("from_warehouse") == "DEPO1" or log.get("to_warehouse") == "DEPO1"


# ============ Create with warehouse ============

def test_create_bobin_with_depo1(hdr):
    payload = {
        "brand": f"TESTWHB_{uuid.uuid4().hex[:6]}",
        "width_cm": 60, "grammage": 28, "color": "Krem", "layers": 1,
        "quantity": 1, "total_weight_kg": 50, "warehouse": "DEPO1",
        "user_name": "pytest",
    }
    r = requests.post(f"{BASE_URL}/api/bobins", json=payload, headers=hdr, timeout=20)
    assert r.status_code == 200, r.text
    bobin = r.json()["bobin"]
    assert bobin.get("warehouse") == "DEPO1", f"Expected DEPO1, got {bobin.get('warehouse')}"
    # verify persistence via summary count incremented (smoke)
    # Just verify the field exists on read
    rl = requests.get(f"{BASE_URL}/api/bobins", headers=hdr, timeout=15)
    found = next((b for b in rl.json() if b["id"] == bobin["id"]), None)
    assert found and found.get("warehouse") == "DEPO1"


def test_create_brand_stock_with_depo2(hdr):
    payload = {
        "brand": f"TESTWHMS_{uuid.uuid4().hex[:6]}",
        "machine": "ICM", "quantity": 5, "warehouse": "DEPO2",
        "user_name": "pytest",
    }
    r = requests.post(f"{BASE_URL}/api/brand-stock", json=payload, headers=hdr, timeout=20)
    assert r.status_code == 200, r.text
    stock = r.json()["stock"]
    assert stock.get("warehouse") == "DEPO2", f"Expected DEPO2, got {stock.get('warehouse')}"
