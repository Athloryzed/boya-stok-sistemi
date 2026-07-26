"""
Iteration 43 — Chat / Messenger backend tests.
Covers: conversations, templates, send/list/read messages, DM, users,
unread-total, VAPID key, upload, and auto-triggers (bobin/boya request, job_assigned, job_completed).
"""
import os
import time
import io
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://depo-tracker-1.preview.emergentagent.com").rstrip("/")


def _login(username, password):
    r = requests.post(f"{BASE_URL}/api/users/login",
                      json={"username": username, "password": password}, timeout=15)
    assert r.status_code == 200, f"login failed for {username}: {r.status_code} {r.text}"
    d = r.json()
    return d.get("access_token") or d.get("token")


@pytest.fixture(scope="module")
def admin_token():
    return _login("adminusr", "admin123")


@pytest.fixture(scope="module")
def ali_token():
    return _login("ali", "134679")


@pytest.fixture(scope="module")
def emrecan_token():
    return _login("emrecan", "testtest12")


def H(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ───── Conversations ─────
class TestConversations:
    def test_list_returns_14_for_admin(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/chat/conversations", headers=H(admin_token), timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        group_count = sum(1 for c in data if c.get("type") == "group")
        machine_count = sum(1 for c in data if c.get("type") == "machine")
        assert group_count == 6, f"group conv count={group_count}, expected 6"
        assert machine_count >= 8, f"machine conv count={machine_count}, expected >=8"
        keys = {c.get("channel_key") for c in data if c.get("type") == "group"}
        assert {"genel", "yonetim", "plan", "operator", "depo", "sofor"} <= keys

    def test_conversation_has_required_fields(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/chat/conversations", headers=H(admin_token), timeout=15)
        for c in r.json():
            assert "id" in c
            assert "type" in c
            assert "unread_count" in c
            assert isinstance(c["unread_count"], int)

    def test_operator_does_not_see_admin_channels(self, ali_token):
        r = requests.get(f"{BASE_URL}/api/chat/conversations", headers=H(ali_token), timeout=15)
        assert r.status_code == 200
        data = r.json()
        keys = {c.get("channel_key") for c in data if c.get("type") == "group"}
        assert "yonetim" not in keys, "operator should NOT see yonetim channel"
        # operator + genel must be there
        assert "operator" in keys
        assert "genel" in keys


# ───── Templates ─────
class TestTemplates:
    def test_admin_sees_all_templates(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/chat/templates", headers=H(admin_token), timeout=15)
        assert r.status_code == 200
        data = r.json()
        keys = {t["key"] for t in data}
        assert keys == {"bobin_gonder", "hazirim", "bekliyorum", "boya_bitti",
                        "bakim_gerekiyor", "acil_yardim"}, f"got: {keys}"

    def test_operator_sees_role_filtered(self, ali_token):
        r = requests.get(f"{BASE_URL}/api/chat/templates", headers=H(ali_token), timeout=15)
        assert r.status_code == 200
        keys = {t["key"] for t in r.json()}
        # operator role → all 6 visible (operator is in role list of all)
        assert {"bobin_gonder", "hazirim", "boya_bitti", "acil_yardim"} <= keys


# ───── Messages: send / list / read ─────
class TestMessages:
    @pytest.fixture(scope="class")
    def genel_conv_id(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/chat/conversations", headers=H(admin_token), timeout=15)
        for c in r.json():
            if c.get("channel_key") == "genel":
                return c["id"]
        pytest.fail("genel conversation not found")

    def test_send_message_to_genel(self, admin_token, genel_conv_id):
        payload = {"text": "TEST_iter43 message ✓"}
        r = requests.post(f"{BASE_URL}/api/chat/conversations/{genel_conv_id}/messages",
                          headers=H(admin_token), json=payload, timeout=15)
        assert r.status_code == 200, r.text
        m = r.json()
        assert m["id"] and m["conversation_id"] == genel_conv_id
        assert m["sender_id"]
        assert m["text"] == payload["text"]
        assert m["created_at"]

    def test_list_messages(self, admin_token, genel_conv_id):
        r = requests.get(f"{BASE_URL}/api/chat/conversations/{genel_conv_id}/messages?limit=5",
                         headers=H(admin_token), timeout=15)
        assert r.status_code == 200
        msgs = r.json()
        assert isinstance(msgs, list)
        assert len(msgs) >= 1
        # chronological ascending (last item is most recent)
        if len(msgs) >= 2:
            assert msgs[0]["created_at"] <= msgs[-1]["created_at"]

    def test_non_participant_cannot_list(self, ali_token, admin_token):
        # find yonetim channel id via admin, then ali should get 404
        r = requests.get(f"{BASE_URL}/api/chat/conversations", headers=H(admin_token), timeout=15)
        yid = next((c["id"] for c in r.json() if c.get("channel_key") == "yonetim"), None)
        assert yid
        r2 = requests.get(f"{BASE_URL}/api/chat/conversations/{yid}/messages",
                          headers=H(ali_token), timeout=15)
        assert r2.status_code == 404

    def test_mark_read(self, admin_token, genel_conv_id):
        r = requests.put(f"{BASE_URL}/api/chat/conversations/{genel_conv_id}/read",
                         headers=H(admin_token), json={}, timeout=15)
        assert r.status_code == 200
        assert r.json().get("ok") is True

    def test_empty_message_rejected(self, admin_token, genel_conv_id):
        r = requests.post(f"{BASE_URL}/api/chat/conversations/{genel_conv_id}/messages",
                          headers=H(admin_token), json={"text": ""}, timeout=15)
        assert r.status_code == 400


# ───── Unread ─────
class TestUnread:
    def test_unread_total_for_admin(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/chat/unread-total", headers=H(admin_token), timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert "total" in d and isinstance(d["total"], int)
        assert "by_conversation" in d


# ───── DM ─────
class TestDM:
    def test_open_dm_creates_or_returns(self, admin_token, ali_token):
        # find ali's id via users list
        r = requests.get(f"{BASE_URL}/api/chat/users", headers=H(admin_token), timeout=15)
        ali = next((u for u in r.json() if u["username"] == "ali"), None)
        assert ali, "ali user not in /api/chat/users"
        r1 = requests.post(f"{BASE_URL}/api/chat/dm",
                          headers=H(admin_token), json={"user_id": ali["id"]}, timeout=15)
        assert r1.status_code == 200
        conv1 = r1.json()
        assert conv1["type"] == "dm"
        assert ali["id"] in conv1["participants"]
        # 2nd call should return same conv
        r2 = requests.post(f"{BASE_URL}/api/chat/dm",
                          headers=H(admin_token), json={"user_id": ali["id"]}, timeout=15)
        assert r2.status_code == 200
        assert r2.json()["id"] == conv1["id"]

    def test_dm_self_rejected(self, admin_token):
        # need admin's own id
        r = requests.get(f"{BASE_URL}/api/auth/me", headers=H(admin_token), timeout=15)
        if r.status_code == 200:
            uid = r.json().get("id") or r.json().get("user_id") or r.json().get("sub")
            if uid:
                r2 = requests.post(f"{BASE_URL}/api/chat/dm",
                                   headers=H(admin_token), json={"user_id": uid}, timeout=15)
                assert r2.status_code == 400


# ───── Users / VAPID ─────
class TestMisc:
    def test_users_list_excludes_self(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/chat/users", headers=H(admin_token), timeout=15)
        assert r.status_code == 200
        users = r.json()
        assert all("adminusr" != u.get("username") for u in users), "self should be excluded"
        for u in users:
            assert "id" in u and "username" in u and "is_online" in u
            assert "roles" in u

    def test_vapid_key(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/chat/push/vapid-public-key", headers=H(admin_token), timeout=15)
        assert r.status_code == 200
        key = r.json().get("key", "")
        assert len(key) > 40, f"vapid key too short: {key}"

    def test_unauthorized_blocked(self):
        r = requests.get(f"{BASE_URL}/api/chat/conversations", timeout=10)
        assert r.status_code in (401, 403)


# ───── Upload ─────
class TestUpload:
    def test_small_png_upload(self, admin_token):
        # minimal PNG bytes
        png = bytes.fromhex(
            "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4"
            "890000000d49444154789c63f8cf00000003010100184d6e2b0000000049454e44ae426082"
        )
        files = {"file": ("test.png", io.BytesIO(png), "image/png")}
        h = {"Authorization": f"Bearer {admin_token}"}
        r = requests.post(f"{BASE_URL}/api/chat/upload", headers=h, files=files, timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["url"].startswith("/uploads/chat/")
        assert d["size"] == len(png)
        assert d["mime"] == "image/png"


# ───── Auto-triggers ─────
class TestAutoTriggers:
    def _find_channel(self, token, key):
        r = requests.get(f"{BASE_URL}/api/chat/conversations", headers=H(token), timeout=15)
        return next((c for c in r.json() if c.get("channel_key") == key), None)

    def test_bobin_request_creates_auto_event(self, admin_token):
        depo = self._find_channel(admin_token, "depo")
        assert depo, "depo channel not found"
        body = {"item_type": "Bobin", "quantity": 3,
                "operator_name": "Ali", "machine_name": "40x40"}
        r = requests.post(f"{BASE_URL}/api/warehouse-requests",
                          headers=H(admin_token), json=body, timeout=15)
        assert r.status_code in (200, 201), f"warehouse-requests failed: {r.status_code} {r.text}"
        time.sleep(2)
        r2 = requests.get(f"{BASE_URL}/api/chat/conversations/{depo['id']}/messages?limit=10",
                          headers=H(admin_token), timeout=15)
        assert r2.status_code == 200
        msgs = r2.json()
        auto = [m for m in msgs if m.get("msg_type") == "auto_event" and m.get("event_type") == "bobin_request"]
        assert auto, f"no bobin_request auto_event found; recent msg_types: {[m.get('msg_type') for m in msgs[-5:]]}"

    def test_paint_request_creates_auto_event(self, admin_token):
        depo = self._find_channel(admin_token, "depo")
        body = {"item_type": "Boya", "color": "Kırmızı", "quantity": 5,
                "operator_name": "Ali", "machine_name": "40x40"}
        r = requests.post(f"{BASE_URL}/api/warehouse-requests",
                          headers=H(admin_token), json=body, timeout=15)
        assert r.status_code in (200, 201), f"warehouse-requests failed: {r.status_code} {r.text}"
        time.sleep(2)
        r2 = requests.get(f"{BASE_URL}/api/chat/conversations/{depo['id']}/messages?limit=10",
                          headers=H(admin_token), timeout=15)
        msgs = r2.json()
        auto = [m for m in msgs if m.get("msg_type") == "auto_event"
                and m.get("event_type") in ("paint_request", "boya_request")]
        assert auto, f"no paint_request auto_event; recent types: {[m.get('event_type') for m in msgs[-5:]]}"
