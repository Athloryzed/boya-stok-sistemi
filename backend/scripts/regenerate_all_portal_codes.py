"""
Acil durum scripti: TÜM müşterilerin portal_code'unu yeniden üretir —
backfill_portal_codes.py'den farkı, zaten kodu olan müşterilerinkini de
değiştirir (sızıntı/ifşa sonrası toplu iptal senaryosu için).

Güvenlik: kazara çalıştırmayı önlemek için önce etkilenecek müşteri sayısını
gösterir ve terminalde "EVET" yazılmasını bekler. Üretilen kodları EKRANA
BASMAZ — sadece kaç müşterinin güncellendiğini yazar (yönetim, yeni kodları
Yönetim/Plan panelindeki müşteri detayından tek tek görüp müşterilere iletir).

Çalıştırma (backend/ dizininden):
    python -m scripts.regenerate_all_portal_codes
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
    total = await db.customers.count_documents({})
    if total == 0:
        print("Hiç müşteri yok, yapılacak bir şey yok.")
        return

    print(f"DİKKAT: Bu işlem TÜM {total} müşterinin portal takip kodunu yeniden üretecek.")
    print("Eski kodlar (varsa) anında geçersiz olur — müşteriler artık onlarla giriş yapamaz.")
    answer = input('Devam etmek için "EVET" yazın: ').strip()
    if answer != "EVET":
        print("İptal edildi, hiçbir şey değiştirilmedi.")
        return

    cursor = db.customers.find({}, {"_id": 0, "id": 1})
    customers = await cursor.to_list(10000)

    updated = 0
    for c in customers:
        code = await _generate_portal_code()
        res = await db.customers.update_one(
            {"id": c["id"]},
            {"$set": {"portal_code": code, "portal_code_updated_at": _now_iso()}},
        )
        if res.modified_count:
            updated += 1

    print(f"Tamamlandı — {updated} müşteri güncellendi.")


if __name__ == "__main__":
    asyncio.run(main())
