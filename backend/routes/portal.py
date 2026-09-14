"""
Müşteri Sipariş Takip Portalı.

- POST /api/portal/login → portal_code ile giriş, 12 saatlik portal token'ı döner.
- GET  /api/portal/jobs  → giriş yapan müşterinin işleri (beyaz liste alanlar).

Görünen veri beyaz liste ile sınırlıdır: iş adı, durum, koli sayısı, ilerleme,
teslim tarihi, tamamlanma tarihi. Fiyat/operatör/makine/iç not/telefon ASLA
dönmez — Job dokümanından elle seçilen alanlar döner, projection ile hariç
tutma değil (ileride Job'a eklenecek yeni bir alan otomatik sızmasın diye).

Filtreleme bir sorgu koşuludur, silme değildir: 7 günden eski tamamlanmış
işler müşteriye görünmez ama veritabanında ve yönetim panelinde kalmaya
devam eder.
"""
from fastapi import APIRouter, HTTPException, Body, Depends, Request
from datetime import datetime, timezone, timedelta
from slowapi import Limiter

from database import db
from auth import create_portal_token, get_current_customer
from services.account_lockout import assert_not_locked, record_failure, record_success
from rate_limit_utils import get_real_client_ip

router = APIRouter()
limiter = Limiter(key_func=get_real_client_ip)

STATUS_MAP = {
    "pending": "Sırada Bekliyor",
    "in_progress": "Üretimde",
    "paused": "Beklemede",
    "completed": "Tamamlandı",
}


@router.post("/portal/login")
@limiter.limit("30/minute")
async def portal_login(request: Request, data: dict = Body(...)):
    code = (data.get("portal_code") or "").strip().upper()
    if not code:
        raise HTTPException(status_code=400, detail="Takip kodu zorunlu")

    account_key = f"portal:{code}"
    await assert_not_locked(account_key)

    customer = await db.customers.find_one(
        {"portal_code": code, "archived": {"$ne": True}}, {"_id": 0}
    )
    ip = get_real_client_ip(request)
    if not customer:
        await record_failure(account_key, ip=ip, reason="invalid_portal_code")
        raise HTTPException(status_code=401, detail="Geçersiz takip kodu")

    await record_success(account_key)
    token = create_portal_token(customer["id"], customer.get("name", ""))
    return {
        "token": token,
        "customer_name": customer.get("name", ""),
        "expires_in": 720 * 60,
    }


@router.get("/portal/jobs")
async def portal_jobs(customer: dict = Depends(get_current_customer)):
    customer_id = customer["id"]
    seven_days_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()

    jobs = await db.jobs.find(
        {
            "customer_id": customer_id,
            "$or": [
                {"status": {"$in": ["pending", "in_progress", "paused"]}},
                {"status": "completed", "completed_at": {"$gte": seven_days_ago}},
            ],
        },
        {"_id": 0},
    ).sort("created_at", -1).to_list(200)

    # Ara ilerleme toplamı — GET /jobs'taki aynı aggregate desen
    ids = [j.get("id") for j in jobs]
    progress_agg = await db.job_progress.aggregate([
        {"$match": {"job_id": {"$in": ids}, "counted": False}},
        {"$group": {"_id": "$job_id", "total": {"$sum": "$amount"}}},
    ]).to_list(len(ids) or 1)
    progress_by_job = {p["_id"]: p["total"] for p in progress_agg}

    result = []
    for j in jobs:
        status = j.get("status", "pending")
        result.append({
            "job_name": j.get("name", ""),
            "status": status,
            "status_text": STATUS_MAP.get(status, "Bilinmiyor"),
            "koli_count": j.get("koli_count", 0),
            "completed_koli": j.get("completed_koli", 0),
            "progress_total": progress_by_job.get(j.get("id"), 0),
            "delivery_date": j.get("delivery_date"),
            "completed_at": j.get("completed_at"),
        })
    return {"customer_name": customer.get("name", ""), "jobs": result}
