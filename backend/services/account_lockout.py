"""
Hesap Kilitleme (Brute-Force Lockout) Servisi.

Politika:
- Her başarısız login `login_attempts` koleksiyonuna yazılır.
- 15 dakika içinde 5 başarısız deneme → hesap 15 dakika kilitlenir.
- Başarılı login tüm önceki başarısız denemeleri temizler.
- Login endpoint, kilit aktif iken 423 (Locked) döner ve geri kalan süreyi bildirir.

Bu yapı `slowapi` rate-limit'in TAMAMLAYICISIDIR (IP yerine kullanıcı bazlı).
"""
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, Tuple

from fastapi import HTTPException

from database import db

logger = logging.getLogger(__name__)

MAX_ATTEMPTS = 5
WINDOW_MINUTES = 15
LOCKOUT_MINUTES = 15


def _now() -> datetime:
    return datetime.now(timezone.utc)


async def is_locked(account_key: str) -> Tuple[bool, Optional[int]]:
    """Hesap kilitli mi? (locked, remaining_seconds)"""
    if not account_key:
        return False, None
    doc = await db.account_lockouts.find_one({"_id": account_key})
    if not doc:
        return False, None
    until = doc.get("locked_until")
    if not until:
        return False, None
    try:
        until_dt = datetime.fromisoformat(until)
    except Exception:
        return False, None
    now = _now()
    if until_dt <= now:
        # Süresi dolmuş — kilidi temizle
        await db.account_lockouts.delete_one({"_id": account_key})
        return False, None
    remaining = int((until_dt - now).total_seconds())
    return True, remaining


async def assert_not_locked(account_key: str):
    """Kilit varsa 423 Locked fırlatır."""
    locked, remaining = await is_locked(account_key)
    if locked:
        raise HTTPException(
            status_code=423,
            detail=f"Hesap geçici olarak kilitli. {remaining // 60} dk {remaining % 60} sn sonra tekrar deneyin."
        )


async def record_failure(account_key: str, ip: str = "", reason: str = ""):
    """Başarısız denemeyi kaydet ve gerekirse kilitle."""
    if not account_key:
        return
    now = _now()
    await db.login_attempts.insert_one({
        "account": account_key,
        "ip": ip or "",
        "reason": reason or "invalid_credentials",
        "created_at": now.isoformat(),
    })
    # Pencere içindeki başarısız denemeleri say
    window_start = (now - timedelta(minutes=WINDOW_MINUTES)).isoformat()
    count = await db.login_attempts.count_documents({
        "account": account_key,
        "created_at": {"$gte": window_start},
    })
    if count >= MAX_ATTEMPTS:
        locked_until = (now + timedelta(minutes=LOCKOUT_MINUTES)).isoformat()
        await db.account_lockouts.update_one(
            {"_id": account_key},
            {"$set": {"locked_until": locked_until, "reason": "brute_force", "locked_at": now.isoformat()}},
            upsert=True,
        )
        logger.warning("Hesap brute-force nedeniyle kilitlendi: %s (count=%s)", account_key, count)


async def record_success(account_key: str):
    """Başarılı login → tüm başarısız denemeleri ve kilidi temizle."""
    if not account_key:
        return
    await db.login_attempts.delete_many({"account": account_key})
    await db.account_lockouts.delete_one({"_id": account_key})
