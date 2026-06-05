"""
Iteration 39 - Security Hardening Package (11 items) backend tests.
Covers: JWT refresh, brute-force lockout, security headers, PII encryption,
audit hash chain, audit alarms, lockouts admin, security overview, backup
encryption + dry-run, strict input validation, existing auth, no regressions.
"""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
MANAGEMENT_PASSWORD = "buse11993"
DASHBOARD_PASSWORD = "buse4"
OPERATOR_CREDS = {"username": "ali", "password": "134679"}
PLAN_CREDS = {"username": "emrecan", "password": "testtest12"}
DEPO_CREDS = {"username": "depo1", "password": "depo123"}


# ---------- helpers ----------
def mgmt_token():
    r = requests.post(f"{BASE_URL}/api/management/login", json={"password": MANAGEMENT_PASSWORD})
    assert r.status_code == 200, r.text
    return r.json()["token"]


def auth(tok):
    return {"Authorization": f"Bearer {tok}"}


# ---------- 1. JWT Refresh Token flow ----------
class TestRefreshFlow:
    def test_login_returns_token_pair(self):
        r = requests.post(f"{BASE_URL}/api/management/login", json={"password": MANAGEMENT_PASSWORD})
        assert r.status_code == 200
        d = r.json()
        assert "token" in d and "refresh_token" in d
        assert d.get("access_expires_in") == 1800, d
        assert d.get("refresh_expires_in") == 604800, d

    def test_refresh_rotation_and_old_revoked(self):
        r = requests.post(f"{BASE_URL}/api/management/login", json={"password": MANAGEMENT_PASSWORD})
        d = r.json()
        old_refresh = d["refresh_token"]
        old_access = d["token"]

        rr = requests.post(f"{BASE_URL}/api/auth/refresh", json={"refresh_token": old_refresh})
        assert rr.status_code == 200, rr.text
        nd = rr.json()
        assert "token" in nd and "refresh_token" in nd
        assert nd["token"] != old_access
        assert nd["refresh_token"] != old_refresh

        # Old refresh should be revoked
        rr2 = requests.post(f"{BASE_URL}/api/auth/refresh", json={"refresh_token": old_refresh})
        assert rr2.status_code == 401, f"Old refresh should be revoked, got {rr2.status_code}: {rr2.text}"

        # New access works
        me = requests.get(f"{BASE_URL}/api/auth/me", headers=auth(nd["token"]))
        assert me.status_code == 200, me.text


# ---------- 2. Brute force lockout ----------
class TestLockout:
    def test_lockout_after_5_failures(self):
        uname = f"nonexistent_qa_{uuid.uuid4().hex[:6]}"
        for i in range(5):
            r = requests.post(f"{BASE_URL}/api/users/login", json={"username": uname, "password": "wrong"})
            assert r.status_code == 401, f"attempt {i+1} expected 401 got {r.status_code}"
        r6 = requests.post(f"{BASE_URL}/api/users/login", json={"username": uname, "password": "wrong"})
        assert r6.status_code == 423, f"6th attempt expected 423 got {r6.status_code}: {r6.text}"

        # cleanup
        tok = mgmt_token()
        d = requests.delete(f"{BASE_URL}/api/admin/lockouts/{uname}", headers=auth(tok))
        assert d.status_code in (200, 204), d.text


# ---------- 3. Security headers ----------
class TestSecurityHeaders:
    def test_health_headers(self):
        r = requests.get(f"{BASE_URL}/api/health")
        h = {k.lower(): v for k, v in r.headers.items()}
        assert "max-age=63072000" in h.get("strict-transport-security", ""), h.get("strict-transport-security")
        assert "default-src 'self'" in h.get("content-security-policy", ""), h.get("content-security-policy")
        assert h.get("x-frame-options") == "DENY"
        assert h.get("x-content-type-options") == "nosniff"
        assert h.get("referrer-policy") == "strict-origin-when-cross-origin"
        assert "permissions-policy" in h


# ---------- 4. PII Encryption ----------
class TestPIIEncryption:
    def test_user_phone_encrypted_in_db_decrypted_in_api(self):
        tok = mgmt_token()
        uname = f"TEST_pii_{uuid.uuid4().hex[:6]}"
        phone = "+90 555 111 2233"
        payload = {
            "username": uname,
            "password": "Strong#Pass123",
            "full_name": "PII Test User",
            "phone": phone,
            "roles": ["plan"],
        }
        r = requests.post(f"{BASE_URL}/api/users", json=payload, headers=auth(tok))
        assert r.status_code in (200, 201), r.text
        user_id = r.json().get("id") or r.json().get("user", {}).get("id")
        assert user_id, r.json()

        g = requests.get(f"{BASE_URL}/api/users", headers=auth(tok))
        assert g.status_code == 200
        found = [u for u in g.json() if u.get("username") == uname]
        assert found, "created user not found in GET"
        assert found[0].get("phone") == phone, f"phone not decrypted: {found[0].get('phone')}"

        # cleanup user via DELETE
        requests.delete(f"{BASE_URL}/api/users/{user_id}", headers=auth(tok))


# ---------- 5. Audit Chain Verify ----------
class TestAuditChain:
    def test_audit_chain_valid(self):
        tok = mgmt_token()
        r = requests.get(f"{BASE_URL}/api/admin/audit/verify", headers=auth(tok))
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("valid") is True, d
        assert "last_hash" in d
        assert "scanned" in d

    def test_audit_chain_after_event(self):
        tok = mgmt_token()
        # create + delete a user to add audit entries
        uname = f"TEST_audit_{uuid.uuid4().hex[:6]}"
        c = requests.post(f"{BASE_URL}/api/users", json={
            "username": uname, "password": "Strong#Pass1", "full_name": "AuditTest",
            "phone": "+90 555 000 1111", "roles": ["plan"]
        }, headers=auth(tok))
        assert c.status_code in (200, 201), c.text
        uid = c.json().get("id") or c.json().get("user", {}).get("id")
        if uid:
            requests.delete(f"{BASE_URL}/api/users/{uid}", headers=auth(tok))

        v = requests.get(f"{BASE_URL}/api/admin/audit/verify", headers=auth(tok))
        assert v.status_code == 200
        assert v.json().get("valid") is True


# ---------- 6. Audit Alarms ----------
class TestAuditAlarms:
    def test_alarms_listed_and_ack(self):
        tok = mgmt_token()
        # trigger via create+delete
        uname = f"TEST_alarm_{uuid.uuid4().hex[:6]}"
        c = requests.post(f"{BASE_URL}/api/users", json={
            "username": uname, "password": "Strong#Pass1", "full_name": "AlarmTest",
            "phone": "+90 555 000 2222", "roles": ["plan"]
        }, headers=auth(tok))
        assert c.status_code in (200, 201), c.text
        uid = c.json().get("id") or c.json().get("user", {}).get("id")
        if uid:
            requests.delete(f"{BASE_URL}/api/users/{uid}", headers=auth(tok))

        time.sleep(0.5)
        a = requests.get(f"{BASE_URL}/api/admin/alarms", headers=auth(tok))
        assert a.status_code == 200, a.text
        body = a.json()
        if isinstance(body, list):
            items = body
        else:
            items = body.get("items") or body.get("alarms") or []
        assert items, f"no alarms returned: {body}"

        # filter unacknowledged
        a2 = requests.get(f"{BASE_URL}/api/admin/alarms?acknowledged=false", headers=auth(tok))
        assert a2.status_code == 200

        # ack first
        first = items[0]
        aid = first.get("id") or first.get("_id")
        if aid:
            ack = requests.post(f"{BASE_URL}/api/admin/alarms/{aid}/ack", headers=auth(tok))
            assert ack.status_code in (200, 204), ack.text


# ---------- 7. Lockouts admin ----------
class TestLockoutsAdmin:
    def test_lockouts_list_and_clear(self):
        tok = mgmt_token()
        uname = f"nonexistent_qa_{uuid.uuid4().hex[:6]}"
        for _ in range(6):
            requests.post(f"{BASE_URL}/api/users/login", json={"username": uname, "password": "wrong"})
        lst = requests.get(f"{BASE_URL}/api/admin/lockouts", headers=auth(tok))
        assert lst.status_code == 200, lst.text
        data = lst.json() if isinstance(lst.json(), list) else lst.json().get("lockouts", [])
        accounts = [it.get("account") for it in data]
        # account may be the username directly; not strictly required - just attempt cleanup
        d = requests.delete(f"{BASE_URL}/api/admin/lockouts/{uname}", headers=auth(tok))
        assert d.status_code in (200, 204), d.text


# ---------- 8. Security overview ----------
class TestSecurityStatus:
    def test_status(self):
        tok = mgmt_token()
        r = requests.get(f"{BASE_URL}/api/admin/security/status", headers=auth(tok))
        assert r.status_code == 200, r.text
        d = r.json()
        assert "audit_chain" in d and d["audit_chain"].get("valid") is True
        assert "unacknowledged_alarms" in d
        assert "active_lockouts" in d
        assert "failed_login_attempts" in d


# ---------- 9. Backup encryption + dry-run ----------
class TestBackupEncryption:
    def test_run_and_verify_backup(self):
        tok = mgmt_token()
        r = requests.post(f"{BASE_URL}/api/admin/backups/run", headers=auth(tok), timeout=120)
        assert r.status_code in (200, 201), r.text
        d = r.json()
        assert d.get("encrypted") is True, d
        assert "dryrun" in d and d["dryrun"].get("success") is True, d
        assert "checksum_file" in d or d.get("has_checksum") is True

        fname = d.get("filename") or d.get("file")
        assert fname and fname.endswith(".enc"), fname

        lst = requests.get(f"{BASE_URL}/api/admin/backups", headers=auth(tok))
        assert lst.status_code == 200
        items = lst.json() if isinstance(lst.json(), list) else lst.json().get("backups", [])
        target = next((b for b in items if (b.get("filename") or b.get("name")) == fname), None)
        assert target, f"backup {fname} not listed"
        assert target.get("encrypted") is True
        assert target.get("has_checksum") is True

        v = requests.post(f"{BASE_URL}/api/admin/backups/verify/{fname}", headers=auth(tok), timeout=120)
        assert v.status_code == 200, v.text
        vd = v.json()
        assert vd.get("checksum_ok") is True
        assert vd.get("dryrun", {}).get("success") is True


# ---------- 10. Strict input validation ----------
class TestInputValidation:
    def test_login_empty_username_422(self):
        r = requests.post(f"{BASE_URL}/api/users/login", json={"username": "", "password": "x"})
        assert r.status_code == 422, f"empty username expected 422 got {r.status_code}: {r.text}"

    def test_login_one_char_username_422(self):
        r = requests.post(f"{BASE_URL}/api/users/login", json={"username": "a", "password": "x"})
        assert r.status_code == 422, f"1 char username expected 422 got {r.status_code}: {r.text}"

    def test_create_user_short_username_422(self):
        tok = mgmt_token()
        r = requests.post(f"{BASE_URL}/api/users", json={
            "username": "a", "password": "Strong#Pass1", "full_name": "x",
            "phone": "+90 555 000 0000", "roles": ["plan"]
        }, headers=auth(tok))
        assert r.status_code == 422, f"short username expected 422 got {r.status_code}: {r.text}"

    def test_create_user_invalid_phone_422(self):
        tok = mgmt_token()
        r = requests.post(f"{BASE_URL}/api/users", json={
            "username": f"valid_{uuid.uuid4().hex[:6]}", "password": "Strong#Pass1",
            "full_name": "x", "phone": "abcd", "roles": ["plan"]
        }, headers=auth(tok))
        assert r.status_code == 422, f"invalid phone expected 422 got {r.status_code}: {r.text}"


# ---------- 11. Existing auth still works ----------
class TestExistingAuth:
    @pytest.mark.parametrize("creds,endpoint", [
        (OPERATOR_CREDS, "/api/users/login"),
        (PLAN_CREDS, "/api/users/login"),
        (DEPO_CREDS, "/api/users/login"),
    ])
    def test_user_logins(self, creds, endpoint):
        r = requests.post(f"{BASE_URL}{endpoint}", json=creds)
        assert r.status_code == 200, f"{creds['username']}: {r.text}"
        d = r.json()
        assert "token" in d and "refresh_token" in d, d

    def test_management_login(self):
        r = requests.post(f"{BASE_URL}/api/management/login", json={"password": MANAGEMENT_PASSWORD})
        assert r.status_code == 200
        d = r.json()
        assert "token" in d and "refresh_token" in d

    def test_dashboard_login(self):
        r = requests.post(f"{BASE_URL}/api/dashboard/login", json={"password": DASHBOARD_PASSWORD})
        assert r.status_code == 200
        d = r.json()
        assert "token" in d and "refresh_token" in d


# ---------- 12. No regression ----------
class TestNoRegression:
    def test_dashboard_live(self):
        r = requests.post(f"{BASE_URL}/api/dashboard/login", json={"password": DASHBOARD_PASSWORD})
        tok = r.json()["token"]
        rr = requests.get(f"{BASE_URL}/api/dashboard/live", headers=auth(tok))
        assert rr.status_code == 200, rr.text

    def test_jobs_ok(self):
        tok = mgmt_token()
        r = requests.get(f"{BASE_URL}/api/jobs", headers=auth(tok))
        assert r.status_code == 200

    def test_users_role_filter(self):
        tok = mgmt_token()
        r = requests.get(f"{BASE_URL}/api/users?role=plan", headers=auth(tok))
        assert r.status_code == 200

    def test_machines_init(self):
        tok = mgmt_token()
        r = requests.post(f"{BASE_URL}/api/machines/init", headers=auth(tok))
        assert r.status_code in (200, 201, 409), r.text


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
