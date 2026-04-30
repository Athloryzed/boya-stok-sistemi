"""
Iteration 27 tests:
- Multi-role user create/login/update
- Backward-compat single role
- GET /users returns roles array + role filter
- Analytics bug fix scenario (produced_koli reflected even when job not completed)
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
API = f"{BASE_URL}/api"


# -------- Fixtures -------- #
@pytest.fixture(scope="module")
def mgmt_token():
    r = requests.post(f"{API}/management/login", json={"password": "buse11993"}, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def auth_headers(mgmt_token):
    return {"Authorization": f"Bearer {mgmt_token}", "Content-Type": "application/json"}


# -------- Multi-role user tests -------- #
class TestMultiRoleUsers:
    created_ids = []

    def test_create_user_with_roles_list(self, auth_headers):
        uname = f"TEST_multi_{uuid.uuid4().hex[:6]}"
        r = requests.post(f"{API}/users", headers=auth_headers, json={
            "username": uname, "password": "pw123", "roles": ["plan", "depo"],
            "display_name": uname
        }, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "role" in data and "roles" in data
        assert data["role"] == "plan"
        assert set(data["roles"]) == {"plan", "depo"}
        TestMultiRoleUsers.created_ids.append((data["id"], uname))

    def test_create_user_legacy_single_role(self, auth_headers):
        uname = f"TEST_single_{uuid.uuid4().hex[:6]}"
        r = requests.post(f"{API}/users", headers=auth_headers, json={
            "username": uname, "password": "pw123", "role": "operator"
        }, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["role"] == "operator"
        assert data["roles"] == ["operator"]
        TestMultiRoleUsers.created_ids.append((data["id"], uname))

    def test_invalid_role_rejected(self, auth_headers):
        r = requests.post(f"{API}/users", headers=auth_headers, json={
            "username": f"TEST_bad_{uuid.uuid4().hex[:4]}", "password": "pw",
            "roles": ["invalidrole"]
        }, timeout=15)
        assert r.status_code == 400

    def test_login_multi_role_coklu_plan(self):
        r = requests.post(f"{API}/users/login",
                          json={"username": "coklukullanici", "password": "test123", "role": "plan"},
                          timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("login_role") == "plan"
        assert "plan" in data.get("roles", [])
        assert "depo" in data.get("roles", [])
        assert "token" in data

    def test_login_multi_role_coklu_depo(self):
        r = requests.post(f"{API}/users/login",
                          json={"username": "coklukullanici", "password": "test123", "role": "depo"},
                          timeout=15)
        assert r.status_code == 200, r.text
        assert r.json().get("login_role") == "depo"

    def test_login_multi_role_forbidden_operator(self):
        r = requests.post(f"{API}/users/login",
                          json={"username": "coklukullanici", "password": "test123", "role": "operator"},
                          timeout=15)
        assert r.status_code == 403, r.text
        detail = r.json().get("detail", "")
        assert "plan" in detail and "depo" in detail  # mesaj rolleri listelesin

    def test_patch_user_roles(self, auth_headers):
        # önce bir kullanıcı oluştur
        uname = f"TEST_patch_{uuid.uuid4().hex[:6]}"
        c = requests.post(f"{API}/users", headers=auth_headers, json={
            "username": uname, "password": "pw", "roles": ["plan"]
        }, timeout=15)
        assert c.status_code == 200
        uid = c.json()["id"]
        TestMultiRoleUsers.created_ids.append((uid, uname))

        # roles güncelle
        p = requests.patch(f"{API}/users/{uid}/roles", headers=auth_headers,
                           json={"roles": ["plan", "depo", "operator"]}, timeout=15)
        assert p.status_code == 200, p.text
        body = p.json()
        assert set(body["roles"]) == {"plan", "depo", "operator"}

        # GET ile doğrula
        g = requests.get(f"{API}/users", headers=auth_headers, timeout=15)
        assert g.status_code == 200
        users = g.json()
        found = next((u for u in users if u["id"] == uid), None)
        assert found is not None
        assert set(found["roles"]) == {"plan", "depo", "operator"}

    def test_patch_user_roles_invalid(self, auth_headers):
        r = requests.patch(f"{API}/users/non-existent-id/roles", headers=auth_headers,
                           json={"roles": ["plan"]}, timeout=15)
        assert r.status_code == 404

        r2 = requests.patch(f"{API}/users/any/roles", headers=auth_headers,
                            json={"roles": []}, timeout=15)
        assert r2.status_code == 400

    def test_get_users_returns_roles_array(self, auth_headers):
        r = requests.get(f"{API}/users", headers=auth_headers, timeout=15)
        assert r.status_code == 200
        users = r.json()
        assert isinstance(users, list) and len(users) > 0
        for u in users:
            assert "roles" in u, f"User {u.get('username')} missing 'roles'"
            assert isinstance(u["roles"], list)

    def test_get_users_role_filter_covers_roles_list(self, auth_headers):
        r = requests.get(f"{API}/users?role=plan", headers=auth_headers, timeout=15)
        assert r.status_code == 200
        users = r.json()
        # coklukullanici (roles=['plan','depo']) bu filtreden dönmeli
        usernames = [u["username"] for u in users]
        assert "coklukullanici" in usernames, f"coklukullanici not returned via role=plan filter. Got: {usernames}"

    def test_regression_legacy_logins(self):
        """Eski tekli-rol login'ler çalışmaya devam ediyor."""
        cases = [
            ("ali", "134679", "operator"),
            ("emrecan", "testtest12", "plan"),
            ("depo1", "depo123", "depo"),
        ]
        for uname, pw, role in cases:
            r = requests.post(f"{API}/users/login",
                              json={"username": uname, "password": pw, "role": role}, timeout=15)
            assert r.status_code == 200, f"{uname}/{role} login failed: {r.status_code} {r.text}"
            data = r.json()
            assert "token" in data
            assert data.get("login_role") == role
            assert isinstance(data.get("roles"), list) and role in data["roles"]

    def test_cleanup(self, auth_headers):
        """TEST_ prefixed kullanıcıları temizle."""
        for uid, _ in TestMultiRoleUsers.created_ids:
            requests.delete(f"{API}/users/{uid}", headers=auth_headers, timeout=10)


# -------- Analytics bug-fix scenario -------- #
class TestAnalyticsBugFix:
    """
    Bug: Vardiya bitirildiğinde iş tamamlanmadıysa produced_koli analytics'e
    yansımıyordu. Şu an:
      - /analytics/daily-by-week: shift_end_reports'taki produced_koli o gün toplamına eklenir
      - eğer iş bugün completed olduysa completed_koli - prior_partials ile dedupe yapılır
    """

    def test_daily_by_week_endpoint_shape(self, auth_headers):
        r = requests.get(f"{API}/analytics/daily-by-week?week_offset=0", headers=auth_headers, timeout=20)
        assert r.status_code == 200, r.text
        body = r.json()
        assert "daily_stats" in body
        assert len(body["daily_stats"]) == 7
        for d in body["daily_stats"]:
            assert "day_name" in d and "total_koli" in d and "full_date" in d
            assert isinstance(d["total_koli"], int)
            assert isinstance(d["machines"], dict)

    def test_daily_by_week_reflects_shift_end_report_for_pending_job(self, auth_headers):
        """
        End-to-end: DB'ye direkt bir shift_end_report eklemek yerine public API üzerinden
        bir iş yaratıp ardından shifts/end-with-report ile produced_koli=10 raporu gönderiyoruz.
        Sonra daily-by-week endpoint'inde bugünkü total_koli'nin en az 10 arttığını doğruluyoruz.
        """
        # Makineleri al
        mr = requests.get(f"{API}/machines", headers=auth_headers, timeout=15)
        assert mr.status_code == 200
        machines = mr.json()
        assert len(machines) > 0
        machine = machines[0]

        # Önceki değer
        before = requests.get(f"{API}/analytics/daily-by-week?week_offset=0",
                              headers=auth_headers, timeout=20).json()
        # Bugünü bul (server UTC kullanıyor)
        from datetime import datetime, timezone
        today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        today_before = next((d for d in before["daily_stats"] if d["full_date"] == today_str), None)
        assert today_before is not None, f"Today {today_str} not in week stats"
        before_total = today_before["total_koli"]

        # İş yarat
        job_payload = {
            "name": f"TEST_analytics_{uuid.uuid4().hex[:6]}",
            "machine_id": machine["id"],
            "machine_name": machine["name"],
            "koli_count": 20,
            "colors": "TEST",
        }
        jc = requests.post(f"{API}/jobs", headers=auth_headers, json=job_payload, timeout=15)
        assert jc.status_code == 200, jc.text
        job = jc.json()

        # Vardiya başlat (varsa zaten aktif olabilir — 400 olur)
        requests.post(f"{API}/shifts/start?started_by=TEST", headers=auth_headers, timeout=15)

        # Vardiya sonu raporu — iş tamamlanmadı, sadece partial 10 koli
        end_payload = {"reports": [{
            "machine_id": machine["id"],
            "machine_name": machine["name"],
            "job_id": job["id"],
            "job_name": job["name"],
            "target_koli": 20,
            "produced_koli": 10,
            "defect_kg": 0,
        }]}
        er = requests.post(f"{API}/shifts/end-with-report", headers=auth_headers,
                           json=end_payload, timeout=15)
        assert er.status_code == 200, er.text

        # Sonraki değer — 10 artış bekleniyor
        after = requests.get(f"{API}/analytics/daily-by-week?week_offset=0",
                             headers=auth_headers, timeout=20).json()
        today_after = next((d for d in after["daily_stats"] if d["full_date"] == today_str), None)
        after_total = today_after["total_koli"]

        diff = after_total - before_total
        # Temizle: test job'u sil
        try:
            requests.delete(f"{API}/jobs/{job['id']}", headers=auth_headers, timeout=10)
            # shift_end_reports'tan temizlemek için DB erişimi yok — public API yok
        except Exception:
            pass

        assert diff >= 10, (
            f"Analytics didn't reflect produced_koli=10. before={before_total} after={after_total} diff={diff}. "
            "Bug: partial shift_end_report pending-job için daily-by-week'e yansımıyor."
        )
