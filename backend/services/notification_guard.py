"""
Bildirim bekçisi — aynı olay (event_key) aynı kullanıcıya HANGİ kanaldan
(FCM, Web Push, çoklu sohbet kanalı) gelirse gelsin SADECE 1 kez bildirim
gitmesini garanti eder. Kayıtlar TTL index ile 6 saatte otomatik silinir.
"""
from datetime import datetime, timezone
from typing import List
import logging

from database import db

logger = logging.getLogger(__name__)


async def claim_users(event_key: str, user_ids: List[str]) -> List[str]:
    """Bu olay için henüz bildirim almamış kullanıcıları atomik işaretler ve döner."""
    if not event_key or not user_ids:
        return list(user_ids or [])
    claimed = []
    now = datetime.now(timezone.utc)
    for uid in dict.fromkeys(user_ids):
        if not uid:
            continue
        try:
            res = await db.notification_receipts.update_one(
                {"event_key": event_key, "user_id": uid},
                {"$setOnInsert": {"event_key": event_key, "user_id": uid, "created_at": now}},
                upsert=True,
            )
            if res.upserted_id is not None:
                claimed.append(uid)
        except Exception:
            pass  # DuplicateKey yarışı → zaten bildirilmiş say
    return claimed
