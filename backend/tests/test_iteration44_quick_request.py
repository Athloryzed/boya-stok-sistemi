"""
Iteration 44 — Quick-Request + Suggested-Users + Notification-Settings tests.
Covers:
  - GET /api/chat/suggested-users
  - GET /api/chat/notification-settings (default)
  - PUT /api/chat/notification-settings (role gate + merge)
  - POST /api/chat/quick-request kinds: bobin / paint / maintenance / emergency / invalid
  - Settings disable → bobin skipped (no new auto_event in #depo)
"""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")


def _login(username, password):
    r = requests.post(f"{BASE_URL}/api/users/login",
                      json={"username": username, "password": password}, timeout=15)
    assert r.status_code == 200, f"login failed for {username}: {r.status_code} {r.text}"
    return (r.json().get("access_token") or r.json().get("token"))


def H(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def admin_token():
    return _login("adminusr", "admin123")


@pytest.fixture(scope="module")
def ali_token():
    return _login("ali", "134679")


def _find_channel(token, key):
    r = requests.get(f"{BASE_URL}/api/chat/conversations", headers=H(token), timeout=15)
    return next((c for c in r.json() if c.get("channel_key") == key), None)


def _latest_messages(token, conv_id, limit=15):
    r = requests.get(f"{BASE_URL}/api/chat/conversations/{conv_id}/messages?limit={limit}",
                     headers=H(token), timeout=15)
    assert r.status_code == 200, r.text
    return r.json()


# ───── Suggested Users ─────
class TestSuggestedUsers:
    def test_returns_max_limit(self, ali_token):
        r = requests.get(f"{BASE_URL}/api/chat/suggested-users?limit=6",
                         headers=H(ali_token), timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert isinstance(data, list)
        assert len(data) <= 6
        for u in data:
            assert "id" in u and "username" in u
            assert "is_online" in u and isinstance(u["is_online"], bool)
            assert "is_recent" in u and isinstance(u["is_recent"], bool)
            assert "roles" in u and isinstance(u["roles"], list)

    def test_operator_target_roles(self, ali_token):
        # Operator → depo/plan/sofor target rolleri öncelikli olur
        r = requests.get(f"{BASE_URL}/api/chat/suggested-users?limit=6",
                         headers=H(ali_token), timeout=15)
        data = r.json()
        # at least one non-operator user should be in suggestions if such users exist
        target = {"depo", "plan", "sofor", "yonetim"}
        roles_seen = set()
        for u in data:
            roles_seen.update(u.get("roles", []))
        assert roles_seen & target, f"Expected operator to see at least one of {target}, got roles={roles_seen}"

    def test_self_excluded(self, ali_token):
        r = requests.get(f"{BASE_URL}/api/chat/suggested-users?limit=10",
                         headers=H(ali_token), timeout=15)
        data = r.json()
        assert all(u.get("username") != "ali" for u in data)


# ───── Notification Settings ─────
class TestNotificationSettings:
    def test_get_default(self, admin_token):
        r = requests.get(f"{BASE_URL}/api/chat/notification-settings",
                         headers=H(admin_token), timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        s = d["settings"]
        # All 5 events should be present
        for key in ("bobin_request", "paint_request", "low_stock", "job_assigned", "job_completed"):
            assert key in s, f"missing setting key: {key}"
            assert "enabled" in s[key]
        # low_stock threshold present
        assert "threshold_l" in s["low_stock"]

    def test_operator_cannot_update(self, ali_token):
        r = requests.put(f"{BASE_URL}/api/chat/notification-settings",
                         headers=H(ali_token),
                         json={"settings": {"bobin_request": {"enabled": False}}},
                         timeout=15)
        assert r.status_code == 403, f"expected 403, got {r.status_code} {r.text}"

    def test_admin_can_update_and_merge(self, admin_token):
        # ensure bobin enabled
        r = requests.put(f"{BASE_URL}/api/chat/notification-settings",
                         headers=H(admin_token),
                         json={"settings": {"bobin_request": {"enabled": True, "target_channels": ["depo"]}}},
                         timeout=15)
        assert r.status_code == 200, r.text
        merged = r.json()["settings"]
        assert merged["bobin_request"]["enabled"] is True
        # other settings should still exist (merge)
        assert "low_stock" in merged
        assert "job_completed" in merged


# ───── Quick-Request endpoints ─────
class TestQuickRequest:
    def test_bobin_creates_warehouse_request_and_auto_event(self, admin_token, ali_token):
        # make sure bobin enabled
        requests.put(f"{BASE_URL}/api/chat/notification-settings",
                     headers=H(admin_token),
                     json={"settings": {"bobin_request": {"enabled": True, "target_channels": ["depo"]}}},
                     timeout=15)
        depo = _find_channel(admin_token, "depo")
        assert depo
        before = _latest_messages(admin_token, depo["id"], 20)
        before_count = sum(1 for m in before if m.get("event_type") == "bobin_request")

        body = {"kind": "bobin", "machine_id": "MACH-IT44", "machine_name": "40x40", "quantity": 5}
        r = requests.post(f"{BASE_URL}/api/chat/quick-request",
                          headers=H(ali_token), json=body, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("ok") is True
        assert d.get("event") == "bobin_request"
        assert d.get("request_id"), "request_id missing"
        time.sleep(1.5)
        after = _latest_messages(admin_token, depo["id"], 20)
        after_count = sum(1 for m in after if m.get("event_type") == "bobin_request")
        assert after_count > before_count, f"no new bobin_request auto_event in #depo (before={before_count}, after={after_count})"

    def test_paint_creates_auto_event(self, admin_token, ali_token):
        requests.put(f"{BASE_URL}/api/chat/notification-settings",
                     headers=H(admin_token),
                     json={"settings": {"paint_request": {"enabled": True, "target_channels": ["depo"]}}},
                     timeout=15)
        depo = _find_channel(admin_token, "depo")
        before = sum(1 for m in _latest_messages(admin_token, depo["id"], 20)
                     if m.get("event_type") == "paint_request")
        body = {"kind": "paint", "machine_id": "MACH-IT44", "machine_name": "40x40",
                "color": "Beyaz", "quantity_l": 2.5}
        r = requests.post(f"{BASE_URL}/api/chat/quick-request",
                          headers=H(ali_token), json=body, timeout=15)
        assert r.status_code == 200, r.text
        assert r.json().get("event") == "paint_request"
        time.sleep(1.5)
        after = sum(1 for m in _latest_messages(admin_token, depo["id"], 20)
                    if m.get("event_type") == "paint_request")
        assert after > before

    def test_maintenance_creates_auto_event(self, admin_token, ali_token):
        # Should appear in #yonetim, #plan, and machine channel — verify in #plan since admin is member
        plan_ch = _find_channel(admin_token, "plan")
        assert plan_ch
        before = sum(1 for m in _latest_messages(admin_token, plan_ch["id"], 20)
                     if m.get("event_type") == "maintenance_request")
        body = {"kind": "maintenance", "machine_id": "MACH-IT44", "machine_name": "40x40",
                "note": "Bıçak değişimi gerek"}
        r = requests.post(f"{BASE_URL}/api/chat/quick-request",
                          headers=H(ali_token), json=body, timeout=15)
        assert r.status_code == 200, r.text
        assert r.json().get("event") == "maintenance_request"
        time.sleep(1.5)
        after_msgs = _latest_messages(admin_token, plan_ch["id"], 20)
        after = sum(1 for m in after_msgs if m.get("event_type") == "maintenance_request")
        assert after > before, f"no maintenance_request in #plan (before={before}, after={after})"
        # verify note in text
        assert any("Bıçak değişimi gerek" in (m.get("text") or "")
                   for m in after_msgs if m.get("event_type") == "maintenance_request")

    def test_emergency_creates_auto_event_in_multiple_channels(self, admin_token, ali_token):
        # Should appear in #yonetim, #plan, #operator, #depo
        channels = ["yonetim", "plan", "operator", "depo"]
        before = {}
        for k in channels:
            ch = _find_channel(admin_token, k)
            if ch:
                before[k] = sum(1 for m in _latest_messages(admin_token, ch["id"], 20)
                                if m.get("event_type") == "emergency")
        body = {"kind": "emergency", "machine_id": "MACH-IT44",
                "machine_name": "40x40", "note": "Yangın!"}
        r = requests.post(f"{BASE_URL}/api/chat/quick-request",
                          headers=H(ali_token), json=body, timeout=15)
        assert r.status_code == 200, r.text
        assert r.json().get("event") == "emergency"
        time.sleep(2)
        for k in before.keys():
            ch = _find_channel(admin_token, k)
            after = sum(1 for m in _latest_messages(admin_token, ch["id"], 20)
                        if m.get("event_type") == "emergency")
            assert after > before[k], f"no emergency auto_event in #{k} (before={before[k]}, after={after})"

    def test_invalid_kind_returns_400(self, ali_token):
        r = requests.post(f"{BASE_URL}/api/chat/quick-request",
                          headers=H(ali_token),
                          json={"kind": "invalid_xxx", "machine_id": "M", "machine_name": "M"},
                          timeout=15)
        assert r.status_code == 400, f"expected 400, got {r.status_code} {r.text}"


# ───── Settings Disable Behavior ─────
class TestSettingsDisable:
    def test_disable_bobin_skips_notification(self, admin_token, ali_token):
        # Disable bobin
        r = requests.put(f"{BASE_URL}/api/chat/notification-settings",
                         headers=H(admin_token),
                         json={"settings": {"bobin_request": {"enabled": False, "target_channels": ["depo"]}}},
                         timeout=15)
        assert r.status_code == 200
        depo = _find_channel(admin_token, "depo")
        before = sum(1 for m in _latest_messages(admin_token, depo["id"], 30)
                     if m.get("event_type") == "bobin_request")
        # Trigger quick-request (should still return 200 + create warehouse-request, but skip notify)
        r2 = requests.post(f"{BASE_URL}/api/chat/quick-request",
                           headers=H(ali_token),
                           json={"kind": "bobin", "machine_id": "MACH-IT44-DIS", "machine_name": "40x40", "quantity": 1},
                           timeout=15)
        assert r2.status_code == 200
        assert r2.json().get("request_id")
        time.sleep(1.5)
        after = sum(1 for m in _latest_messages(admin_token, depo["id"], 30)
                    if m.get("event_type") == "bobin_request")
        assert after == before, f"bobin_request was sent even though disabled (before={before}, after={after})"

        # Re-enable
        r3 = requests.put(f"{BASE_URL}/api/chat/notification-settings",
                          headers=H(admin_token),
                          json={"settings": {"bobin_request": {"enabled": True, "target_channels": ["depo"]}}},
                          timeout=15)
        assert r3.status_code == 200

        # Trigger again — should produce a new event
        r4 = requests.post(f"{BASE_URL}/api/chat/quick-request",
                           headers=H(ali_token),
                           json={"kind": "bobin", "machine_id": "MACH-IT44-DIS", "machine_name": "40x40", "quantity": 2},
                           timeout=15)
        assert r4.status_code == 200
        time.sleep(1.5)
        final = sum(1 for m in _latest_messages(admin_token, depo["id"], 30)
                    if m.get("event_type") == "bobin_request")
        assert final > after, f"re-enable failed (after={after}, final={final})"
