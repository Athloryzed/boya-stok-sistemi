"""
Web Push (VAPID) servisi — tarayıcılara arkaplan bildirimi gönderir.
Anahtarlar: /app/backend/.vapid_private.pem + .vapid_public.txt
İlk başlatmada otomatik üretilir.
"""
from pathlib import Path
from typing import List, Optional
import json
import logging
import os
import base64

from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.backends import default_backend

logger = logging.getLogger(__name__)

ROOT_DIR = Path(__file__).parent.parent
VAPID_PRIVATE_FILE = ROOT_DIR / ".vapid_private.pem"
VAPID_PUBLIC_FILE = ROOT_DIR / ".vapid_public.txt"

_VAPID_PUBLIC_KEY: Optional[str] = None
_VAPID_PRIVATE_KEY_PEM: Optional[bytes] = None
VAPID_CLAIMS_SUB = os.environ.get("VAPID_CLAIMS_SUB", "mailto:admin@busekagit.local")


def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _ensure_keys():
    """VAPID anahtar çiftini üretir (yoksa)."""
    global _VAPID_PUBLIC_KEY, _VAPID_PRIVATE_KEY_PEM
    if _VAPID_PUBLIC_KEY and _VAPID_PRIVATE_KEY_PEM:
        return

    if VAPID_PRIVATE_FILE.exists() and VAPID_PUBLIC_FILE.exists():
        _VAPID_PRIVATE_KEY_PEM = VAPID_PRIVATE_FILE.read_bytes()
        _VAPID_PUBLIC_KEY = VAPID_PUBLIC_FILE.read_text().strip()
        logger.info("VAPID keys loaded from disk")
        return

    # Yeni anahtar üret
    private_key = ec.generate_private_key(ec.SECP256R1(), default_backend())
    pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    )

    # X9.62 uncompressed (65 byte, 0x04 + x + y) → base64url
    public_numbers = private_key.public_key().public_numbers()
    x = public_numbers.x.to_bytes(32, "big")
    y = public_numbers.y.to_bytes(32, "big")
    raw_pub = b"\x04" + x + y
    pub_b64 = _b64url(raw_pub)

    VAPID_PRIVATE_FILE.write_bytes(pem)
    VAPID_PUBLIC_FILE.write_text(pub_b64)
    try:
        os.chmod(VAPID_PRIVATE_FILE, 0o600)
    except Exception:
        pass

    _VAPID_PRIVATE_KEY_PEM = pem
    _VAPID_PUBLIC_KEY = pub_b64
    logger.info("VAPID keys generated and saved")


def get_vapid_public_key() -> str:
    _ensure_keys()
    return _VAPID_PUBLIC_KEY or ""


async def send_push(subscription: dict, payload: dict) -> bool:
    """Bir aboneye push gönder. Subscription = {endpoint, p256dh, auth}."""
    try:
        from pywebpush import webpush, WebPushException
    except ImportError:
        logger.warning("pywebpush not installed")
        return False

    _ensure_keys()
    sub_info = {
        "endpoint": subscription.get("endpoint"),
        "keys": {
            "p256dh": subscription.get("p256dh"),
            "auth": subscription.get("auth"),
        },
    }
    try:
        webpush(
            subscription_info=sub_info,
            data=json.dumps(payload, ensure_ascii=False),
            vapid_private_key=_VAPID_PRIVATE_KEY_PEM.decode(),
            vapid_claims={"sub": VAPID_CLAIMS_SUB},
            ttl=60 * 60 * 24,  # 24 saat
        )
        return True
    except Exception as e:  # WebPushException + diğer
        logger.warning(f"web push failed endpoint={sub_info['endpoint'][:50]}...: {e}")
        # 410 Gone → aboneliği temizle (bunu çağıran route yapacak)
        if "410" in str(e) or "404" in str(e):
            return False
        return False


async def send_push_to_users(user_ids: List[str], payload: dict, db, event_key: Optional[str] = None):
    """Birden fazla kullanıcıya push gönder. Eski abonelikleri temizle.

    event_key verilirse bildirim bekçisi uygulanır: aynı olay için daha önce
    (FCM veya başka kanaldan) bildirim almış kullanıcılar atlanır.
    """
    if not user_ids:
        return
    if event_key:
        from services.notification_guard import claim_users
        user_ids = await claim_users(event_key, user_ids)
        if not user_ids:
            return
    subs = await db.push_subscriptions.find({"user_id": {"$in": user_ids}}, {"_id": 0}).to_list(500)
    if not subs:
        return
    dead = []
    for sub in subs:
        ok = await send_push(sub, payload)
        if not ok:
            dead.append(sub.get("id"))
    if dead:
        await db.push_subscriptions.delete_many({"id": {"$in": dead}})
