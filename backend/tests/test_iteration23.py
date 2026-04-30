"""
Iteration 23 tests:
- Login endpoint for depo1, emrecan, operator (ali)
- Bobin access with token
- Audit logs pagination
- Management login
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://bobin-tracker-pro.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


def _login(username, password):
    return requests.post(f"{API}/users/login", json={"username": username, "password": password}, timeout=20)


# ---- User login tests ----
class TestUserLogin:
    def _extract_role(self, data):
        # Support both flat (role at top level) and nested ("user": {...}) responses
        if "role" in data:
            return data["role"]
        return data.get("user", {}).get("role")

    def test_depo1_login(self):
        r = _login("depo1", "depo123")
        assert r.status_code == 200, r.text
        data = r.json()
        assert "token" in data
        assert self._extract_role(data) == "depo"

    def test_emrecan_plan_login(self):
        r = _login("emrecan", "testtest12")
        assert r.status_code == 200, r.text
        data = r.json()
        assert "token" in data
        assert self._extract_role(data) == "plan"

    def test_ali_operator_login(self):
        r = _login("ali", "134679")
        assert r.status_code == 200, r.text
        data = r.json()
        assert "token" in data
        assert self._extract_role(data) == "operator"

    def test_invalid_login(self):
        r = _login("invalid_user_xyz", "wrongpass")
        assert r.status_code in (400, 401, 403, 404)


# ---- Bobin access with role token ----
class TestBobinAccess:
    def _token(self, u, p):
        r = _login(u, p)
        assert r.status_code == 200
        return r.json()["token"]

    def test_depo_can_access_bobins(self):
        token = self._token("depo1", "depo123")
        r = requests.get(f"{API}/bobins", headers={"Authorization": f"Bearer {token}"}, timeout=20)
        assert r.status_code == 200, r.text
        assert isinstance(r.json(), list)

    def test_plan_can_access_bobins(self):
        token = self._token("emrecan", "testtest12")
        r = requests.get(f"{API}/bobins", headers={"Authorization": f"Bearer {token}"}, timeout=20)
        assert r.status_code == 200, r.text
        assert isinstance(r.json(), list)

    def test_bobins_no_auth(self):
        r = requests.get(f"{API}/bobins", timeout=20)
        # Expect 401 or 403
        assert r.status_code in (401, 403), r.text


# ---- Management login + audit logs pagination ----
class TestManagementAuditLogs:
    @pytest.fixture(scope="class")
    def mgmt_token(self):
        r = requests.post(f"{API}/management/login", json={"password": "buse11993"}, timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        return data.get("token")

    def test_management_login(self, mgmt_token):
        assert mgmt_token

    def test_audit_logs_page_0(self, mgmt_token):
        headers = {"Authorization": f"Bearer {mgmt_token}"} if mgmt_token else {}
        r = requests.get(f"{API}/audit-logs?limit=100&skip=0", headers=headers, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "logs" in data
        assert "total" in data
        assert isinstance(data["logs"], list)

    def test_audit_logs_page_1_different(self, mgmt_token):
        """Verify pagination returns different data for different skip values"""
        headers = {"Authorization": f"Bearer {mgmt_token}"} if mgmt_token else {}
        r0 = requests.get(f"{API}/audit-logs?limit=100&skip=0", headers=headers, timeout=30)
        r1 = requests.get(f"{API}/audit-logs?limit=100&skip=100", headers=headers, timeout=30)
        assert r0.status_code == 200
        assert r1.status_code == 200
        d0 = r0.json()
        d1 = r1.json()
        assert d0.get("total") == d1.get("total"), "Total should be consistent"
        if d0.get("total", 0) > 100:
            ids0 = {l.get("id") for l in d0.get("logs", [])}
            ids1 = {l.get("id") for l in d1.get("logs", [])}
            assert ids0 != ids1, "Page 0 and page 1 should have different logs"
        else:
            pytest.skip(f"Not enough audit logs to test pagination (total={d0.get('total')})")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
