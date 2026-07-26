"""
Iteration 51 — Panel AI Asistanı (Claude Opus 4.8) backend testleri.

Testler:
- /api/ai/panel-info modeli claude-opus-4-8 döndürüyor mu?
- Eski AI endpointleri (management-overview/chat, operator-suggestion/chat, paint-forecast) çalışıyor mu?
- Tüm paneller için /api/ai/panel-chat 200 dönüyor mu?
- RBAC: boyaci → bobin/depo 403, boyaci → boyaci/paint 200
- Validation: geçersiz panel 400, boş mesaj 400
- Kalıcı geçmiş: panel-history GET, DELETE
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")

ADMIN = {"username": "adminusr", "password": "admin123"}
BOYACI = {"username": "boyaci1", "password": "boya123"}
OP = {"username": "ali", "password": "134679"}

# Panel & panel için kullanılacak örnek soru
PANELS = [
    ("plan", "Bugün en kritik iş hangisi?"),
    ("boyaci", "Sıradaki işi kısaca söyle"),
    ("depo", "Bekleyen depo talebi var mı?"),
    ("bobin", "Kritik bobin var mı?"),
    ("marka_stok", "Düşük stok var mı?"),
    ("sofor", "Aktif sevkiyat var mı?"),
    ("paint", "Kritik boya var mı?"),
    ("operator", "Vardiyada nelere dikkat etmeliyim?"),
    ("yonetim", "Fabrika özetini ver"),
]


def _login(creds):
    r = requests.post(f"{BASE_URL}/api/users/login", json=creds, timeout=15)
    assert r.status_code == 200, f"Login failed for {creds['username']}: {r.status_code} {r.text}"
    tok = r.json().get("access_token") or r.json().get("token")
    assert tok, f"No token in login response: {r.json()}"
    return tok


@pytest.fixture(scope="module")
def admin_token():
    return _login(ADMIN)


@pytest.fixture(scope="module")
def boyaci_token():
    return _login(BOYACI)


@pytest.fixture(scope="module")
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="module")
def boyaci_headers(boyaci_token):
    return {"Authorization": f"Bearer {boyaci_token}"}


# ---------- Model config ----------

def test_panel_info_returns_claude(admin_headers):
    r = requests.get(f"{BASE_URL}/api/ai/panel-info", headers=admin_headers, timeout=15)
    assert r.status_code == 200
    data = r.json()
    assert data["provider"] == "anthropic"
    assert data["model"] == "claude-opus-4-8"
    assert data["configured"] is True


# ---------- Eski AI endpointleri (Claude ile) ----------

def test_management_overview(admin_headers):
    r = requests.get(f"{BASE_URL}/api/ai/management-overview", headers=admin_headers, timeout=45)
    assert r.status_code == 200, r.text
    text = (r.json().get("overview") or r.json().get("summary") or str(r.json())).lower()
    assert "gpt" not in text


def test_management_chat(admin_headers):
    r = requests.post(
        f"{BASE_URL}/api/ai/management-chat",
        headers=admin_headers,
        json={"message": "Kısaca durumu özetle"},
        timeout=45,
    )
    assert r.status_code == 200, r.text


def test_paint_forecast(admin_headers):
    r = requests.get(f"{BASE_URL}/api/ai/paint-forecast", headers=admin_headers, timeout=45)
    assert r.status_code == 200, r.text


# ---------- panel-chat: her panel için 1 istek ----------

@pytest.mark.parametrize("panel,question", PANELS)
def test_panel_chat_all_panels(admin_headers, panel, question):
    r = requests.post(
        f"{BASE_URL}/api/ai/panel-chat",
        headers=admin_headers,
        json={"panel": panel, "message": question},
        timeout=60,
    )
    assert r.status_code == 200, f"{panel} failed: {r.status_code} {r.text[:300]}"
    data = r.json()
    assert data["panel"] == panel
    assert data["model"] == "claude-opus-4-8"
    reply = data.get("reply") or ""
    assert isinstance(reply, str) and len(reply) > 5
    assert "gpt" not in reply.lower()


# ---------- RBAC ----------

def test_rbac_boyaci_denied_bobin(boyaci_headers):
    r = requests.post(
        f"{BASE_URL}/api/ai/panel-chat",
        headers=boyaci_headers,
        json={"panel": "bobin", "message": "test"},
        timeout=20,
    )
    assert r.status_code == 403, r.text


def test_rbac_boyaci_denied_depo(boyaci_headers):
    r = requests.post(
        f"{BASE_URL}/api/ai/panel-chat",
        headers=boyaci_headers,
        json={"panel": "depo", "message": "test"},
        timeout=20,
    )
    assert r.status_code == 403, r.text


def test_rbac_boyaci_allowed_boyaci(boyaci_headers):
    r = requests.post(
        f"{BASE_URL}/api/ai/panel-chat",
        headers=boyaci_headers,
        json={"panel": "boyaci", "message": "Sıradaki iş?"},
        timeout=60,
    )
    assert r.status_code == 200, r.text


def test_rbac_boyaci_allowed_paint(boyaci_headers):
    r = requests.post(
        f"{BASE_URL}/api/ai/panel-chat",
        headers=boyaci_headers,
        json={"panel": "paint", "message": "Kritik boya?"},
        timeout=60,
    )
    assert r.status_code == 200, r.text


# ---------- Validation ----------

def test_invalid_panel(admin_headers):
    r = requests.post(
        f"{BASE_URL}/api/ai/panel-chat",
        headers=admin_headers,
        json={"panel": "invalidx", "message": "test"},
        timeout=15,
    )
    assert r.status_code == 400


def test_empty_message(admin_headers):
    r = requests.post(
        f"{BASE_URL}/api/ai/panel-chat",
        headers=admin_headers,
        json={"panel": "plan", "message": "   "},
        timeout=15,
    )
    assert r.status_code == 400


# ---------- Kalıcı geçmiş ----------

def test_persistent_history_and_delete(admin_headers):
    # önce mevcut geçmişi sil
    requests.delete(f"{BASE_URL}/api/ai/panel-history?panel=yonetim", headers=admin_headers, timeout=15)

    # 1. mesaj — chat
    r1 = requests.post(
        f"{BASE_URL}/api/ai/panel-chat",
        headers=admin_headers,
        json={"panel": "yonetim", "message": "TEST_iter51 ilk mesaj"},
        timeout=60,
    )
    assert r1.status_code == 200, r1.text

    # geçmiş: en az 2 mesaj (user+assistant)
    h = requests.get(f"{BASE_URL}/api/ai/panel-history?panel=yonetim", headers=admin_headers, timeout=15)
    assert h.status_code == 200
    msgs = h.json().get("messages", [])
    assert len(msgs) >= 2
    roles = [m.get("role") for m in msgs]
    assert "user" in roles and "assistant" in roles

    # 2. mesaj — önceki context'i biliyor mu (sadece 200 ve yanıt döndüğünü doğrula)
    r2 = requests.post(
        f"{BASE_URL}/api/ai/panel-chat",
        headers=admin_headers,
        json={"panel": "yonetim", "message": "İlk sorumda ne yazmıştım? Kısa cevap ver."},
        timeout=60,
    )
    assert r2.status_code == 200, r2.text

    h2 = requests.get(f"{BASE_URL}/api/ai/panel-history?panel=yonetim", headers=admin_headers, timeout=15)
    assert len(h2.json().get("messages", [])) >= 4

    # DELETE geçmiş
    d = requests.delete(f"{BASE_URL}/api/ai/panel-history?panel=yonetim", headers=admin_headers, timeout=15)
    assert d.status_code == 200
    assert d.json().get("ok") is True

    h3 = requests.get(f"{BASE_URL}/api/ai/panel-history?panel=yonetim", headers=admin_headers, timeout=15)
    assert h3.json().get("messages") == []
