"""
Iteration 50 - Verify GET /api/jobs?status=pending sorts by `order` then `created_at`,
while other statuses (completed / no status) keep created_at ordering.
"""
import os
import requests
import pytest

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL').rstrip('/')


@pytest.fixture(scope="module")
def token():
    r = requests.post(f"{BASE_URL}/api/users/login",
                      json={"username": "emrecan", "password": "testtest12"})
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def boyaci_token():
    r = requests.post(f"{BASE_URL}/api/users/login",
                      json={"username": "boyaci1", "password": "boya123"})
    assert r.status_code == 200, r.text
    return r.json()["token"]


def _hdr(t):
    return {"Authorization": f"Bearer {t}"}


def test_pending_sorted_by_order_asc(token):
    r = requests.get(f"{BASE_URL}/api/jobs?status=pending", headers=_hdr(token))
    assert r.status_code == 200
    jobs = r.json()
    orders = [j.get("order", 0) or 0 for j in jobs]
    assert orders == sorted(orders), f"pending not sorted by order: {orders}"
    print(f"Pending order sequence: {orders[:15]}")
    print(f"Names: {[j['name'] for j in jobs[:8]]}")


def test_completed_still_sorted_by_created_at(token):
    r = requests.get(f"{BASE_URL}/api/jobs?status=completed", headers=_hdr(token))
    assert r.status_code == 200
    jobs = r.json()
    if len(jobs) < 2:
        pytest.skip("Not enough completed jobs to verify")
    ts = [j.get("created_at", "") for j in jobs]
    assert ts == sorted(ts), "completed jobs not sorted by created_at asc"


def test_reorder_reflects_in_get(boyaci_token, token):
    """Reorder two pending jobs and verify GET returns new order."""
    r = requests.get(f"{BASE_URL}/api/jobs?status=pending", headers=_hdr(boyaci_token))
    assert r.status_code == 200
    jobs = r.json()
    if len(jobs) < 2:
        pytest.skip("Need at least 2 pending jobs")

    j0, j1 = jobs[0], jobs[1]
    orig_order_0 = j0.get("order", 0) or 0
    orig_order_1 = j1.get("order", 0) or 0

    # Swap
    payload = {"jobs": [
        {"job_id": j0["id"], "order": orig_order_1},
        {"job_id": j1["id"], "order": orig_order_0},
    ]}
    rr = requests.put(f"{BASE_URL}/api/jobs/reorder-batch", json=payload, headers=_hdr(boyaci_token))
    assert rr.status_code == 200

    # Verify from a different user (plan)
    r2 = requests.get(f"{BASE_URL}/api/jobs?status=pending", headers=_hdr(token))
    assert r2.status_code == 200
    new_jobs = r2.json()
    # find positions of j0 and j1 -> j1 should now come before j0 if orig_order_1 < orig_order_0 (or vice versa)
    idx0 = next(i for i, x in enumerate(new_jobs) if x["id"] == j0["id"])
    idx1 = next(i for i, x in enumerate(new_jobs) if x["id"] == j1["id"])
    if orig_order_0 < orig_order_1:
        # After swap, j1 should be before j0
        assert idx1 < idx0, f"expected j1 before j0, got idx0={idx0} idx1={idx1}"
    else:
        assert idx0 < idx1

    # Restore
    restore = {"jobs": [
        {"job_id": j0["id"], "order": orig_order_0},
        {"job_id": j1["id"], "order": orig_order_1},
    ]}
    requests.put(f"{BASE_URL}/api/jobs/reorder-batch", json=restore, headers=_hdr(boyaci_token))
