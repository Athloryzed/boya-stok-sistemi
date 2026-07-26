"""Iteration 46 — Audit logs stringification & customer create audit trail."""
import os
import json
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001").rstrip("/")


@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{BASE_URL}/api/users/login", json={"username": "adminusr", "password": "admin123"})
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def headers(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def test_audit_logs_all_string_fields(headers):
    r = requests.get(f"{BASE_URL}/api/audit-logs?limit=200&skip=0", headers=headers)
    assert r.status_code == 200
    body = r.json()
    assert "logs" in body and "total" in body
    for log in body["logs"]:
        for f in ("user", "action", "entity_type", "entity_name", "details"):
            assert isinstance(log.get(f, ""), str), f"field {f} not string: {log.get(f)!r} in log id={log.get('id')}"


def test_badlegacy_record_present_and_stringified(headers):
    r = requests.get(f"{BASE_URL}/api/audit-logs?limit=1000&skip=0", headers=headers)
    assert r.status_code == 200
    body = r.json()
    bad = [l for l in body["logs"] if l.get("id") == "BADLEGACY1"]
    if not bad:
        pytest.skip("BADLEGACY1 not in first page — dataset moved on; skipping")
    log = bad[0]
    assert isinstance(log["entity_type"], str)
    # Should contain original dict keys serialized as JSON
    assert "customer_id" in log["entity_type"] or "BadCustomer" in log["entity_type"]


def test_pagination_works(headers):
    r1 = requests.get(f"{BASE_URL}/api/audit-logs?limit=10&skip=0", headers=headers)
    r2 = requests.get(f"{BASE_URL}/api/audit-logs?limit=10&skip=10", headers=headers)
    assert r1.status_code == 200 and r2.status_code == 200
    ids1 = {l["id"] for l in r1.json()["logs"]}
    ids2 = {l["id"] for l in r2.json()["logs"]}
    # Ensure no overlap (unless total<10)
    if len(ids1) == 10 and len(ids2) > 0:
        assert ids1.isdisjoint(ids2)


def test_customer_create_writes_correct_audit(headers):
    import uuid
    name = f"TEST_AUDIT_{uuid.uuid4().hex[:6]}"
    r = requests.post(f"{BASE_URL}/api/customers", json={"name": name, "phone": "5551234567"}, headers=headers)
    assert r.status_code == 200, r.text
    cust = r.json()
    code = cust.get("code")

    # Fetch newest audit logs
    r = requests.get(f"{BASE_URL}/api/audit-logs?limit=20&skip=0", headers=headers)
    assert r.status_code == 200
    logs = r.json()["logs"]
    matching = [l for l in logs if l.get("entity_name") == name]
    assert matching, f"No audit log for new customer {name}. Logs: {[l.get('entity_name') for l in logs[:5]]}"
    log = matching[0]
    assert log["user"] == "adminusr"
    assert log["action"] == "create"
    assert log["entity_type"] == "customer"
    assert isinstance(log["details"], str)
    if code:
        assert code in log["details"]

    # Cleanup
    if cust.get("id"):
        requests.delete(f"{BASE_URL}/api/customers/{cust['id']}", headers=headers)
