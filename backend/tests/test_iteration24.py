"""Iteration 24 — Regression test for industrial UI polish pass.
Verifies backend endpoints still return 200 after frontend-only changes.
"""
import os
import time
import pytest
import requests
from pathlib import Path


def _load_frontend_env():
    env_path = Path("/app/frontend/.env")
    if env_path.exists():
        for line in env_path.read_text().splitlines():
            if line.startswith("REACT_APP_BACKEND_URL="):
                return line.split("=", 1)[1].strip()
    return None


BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or _load_frontend_env()).rstrip("/")
API = f"{BASE_URL}/api"


def _login(username_or_password, password=None):
    """Login helper supporting both role-only (management) and username+password."""
    if password is None:
        # management: separate endpoint, password-only
        return requests.post(f"{API}/management/login", json={"password": username_or_password}, timeout=15)
    return requests.post(f"{API}/users/login", json={"username": username_or_password, "password": password}, timeout=15)


@pytest.fixture(scope="module")
def management_token():
    # rate-limit friendly: small delay
    time.sleep(1)
    r = _login("buse11993")
    assert r.status_code == 200, f"management login failed: {r.status_code} {r.text}"
    data = r.json()
    assert "token" in data or "access_token" in data
    token = data.get("token") or data.get("access_token")
    assert token, "No token in login response"
    return token


@pytest.fixture(scope="module")
def auth_headers(management_token):
    return {"Authorization": f"Bearer {management_token}"}


# --- Login regression ---

def test_management_login():
    time.sleep(1)
    r = _login("buse11993")
    assert r.status_code == 200
    data = r.json()
    # management/login may not return role
    assert data.get("token") or data.get("access_token"), "no token in response"


def test_operator_login():
    time.sleep(1)
    r = _login("ali", "134679")
    assert r.status_code == 200
    assert r.json().get("role") in ("operator", "operatör")


def test_plan_login():
    time.sleep(1)
    r = _login("emrecan", "testtest12")
    assert r.status_code == 200
    assert r.json().get("role") in ("plan", "planlama")


# --- Core endpoints regression ---

def test_jobs_endpoint(auth_headers):
    r = requests.get(f"{API}/jobs", headers=auth_headers, timeout=15)
    assert r.status_code == 200, f"/api/jobs failed: {r.status_code} {r.text[:200]}"
    data = r.json()
    assert isinstance(data, (list, dict)), "jobs response must be list or dict"


def test_machines_endpoint(auth_headers):
    r = requests.get(f"{API}/machines", headers=auth_headers, timeout=15)
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, (list, dict))


def test_shifts_current_endpoint(auth_headers):
    r = requests.get(f"{API}/shifts/current", headers=auth_headers, timeout=15)
    # either current shift returned, or null/empty - must not 500
    assert r.status_code in (200, 204), f"/api/shifts/current failed: {r.status_code}"


def test_audit_logs_pagination(auth_headers):
    r = requests.get(f"{API}/audit-logs?skip=0", headers=auth_headers, timeout=15)
    assert r.status_code == 200
    data = r.json()
    # Should have logs list and total
    assert "logs" in data or isinstance(data, list), f"unexpected audit logs shape: {list(data.keys()) if isinstance(data, dict) else type(data)}"
    if isinstance(data, dict):
        assert "total" in data
