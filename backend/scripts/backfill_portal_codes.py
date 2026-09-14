"""
Tek seferlik migration: portal_code alanı olmayan mevcut müşterilere
10 haneli sipariş takip portalı kodu üretir.

Çalıştırma (backend/ dizininden):
    python -m scripts.backfill_portal_codes
"""
import asyncio
import secrets
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from database import db  # noqa: E402

PORTAL_CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"
PORTAL_CODE_LENGTH = 10


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


async def _generate_portal_code() -> str:
    for _ in range(20):
        code = "".join(secrets.choice(PORTAL_CODE_ALPHABET) for _ in range(PORTAL_CODE_LENGTH))
        existing = await db.customers.find_one({"portal_code": code}, {"_id": 0, "id": 1})
        if not existing:
            return code
    raise RuntimeError("Portal kodu üretilemedi (20 deneme başarısız)")


async def main():
    cursor = db.customers.find(
        {"$or": [{"portal_code": None}, {"portal_code": {"$exists": False}}]},
        {"_id": 0, "id": 1, "name": 1},
    )
    customers = await cursor.to_list(10000)
    print(f"{len(customers)} müşteride portal_code eksik, üretiliyor...")

    updated = 0
    for c in customers:
        code = await _generate_portal_code()
        res = await db.customers.update_one(
            {"id": c["id"]},
            {"$set": {"portal_code": code, "portal_code_updated_at": _now_iso()}},
        )
        if res.modified_count:
            updated += 1
            print(f"  {c.get('name', c['id'])}: {code}")

    print(f"Tamamlandı — {updated}/{len(customers)} müşteri güncellendi.")


if __name__ == "__main__":
    asyncio.run(main())
