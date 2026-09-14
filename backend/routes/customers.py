"""
Customer (Müşteri) API.

- GET    /api/customers             → Tüm müşteriler (auth)
- GET    /api/customers/search?q=X  → İsim/telefon ile arama (combobox için)
- GET    /api/customers/{id}        → Tek müşteri detayı
- GET    /api/customers/{id}/jobs   → Müşterinin mevcut + geçmiş işleri
- POST   /api/customers             → Yeni müşteri ekle
- PUT    /api/customers/{id}        → Müşteri güncelle
- DELETE /api/customers/{id}        → Arşivle (soft delete)
"""
from fastapi import APIRouter, HTTPException, Body, Depends, Query
from typing import Optional, List
from datetime import datetime, timezone
import re
import secrets
import uuid

from database import db
from models import Customer
from auth import get_current_user, get_user_roles, is_yonetim
from services.audit import log_audit

router = APIRouter()

# Yonetim dışına gösterilmeyecek fiyat alanları
PRICING_FIELDS = ["unit_price", "extra_charge", "extra_charge_note", "total_price", "priced_by", "priced_at"]

# Yonetim/plan dışına gösterilmeyecek portal kodu alanları — bu, müşterinin
# sipariş takip portalına giriş kimlik bilgisidir, panel personeli genelinde
# görünmemeli.
PORTAL_CODE_FIELDS = ["portal_code", "portal_code_updated_at"]

# Sipariş takip portalı kodu için karakter kümesi — karışabilecek karakterler
# hariç: 0/O, 1/l/I.
PORTAL_CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"
PORTAL_CODE_LENGTH = 10


def _strip_portal_fields(doc: dict) -> dict:
    for f in PORTAL_CODE_FIELDS:
        doc.pop(f, None)
    return doc


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


async def _generate_code() -> str:
    """BK-2026-001 formatında sıralı kod üret."""
    year = datetime.now(timezone.utc).year
    prefix = f"BK-{year}-"
    last = await db.customers.find(
        {"code": {"$regex": f"^{prefix}"}},
        {"_id": 0, "code": 1},
    ).sort("code", -1).limit(1).to_list(1)
    next_num = 1
    if last and last[0].get("code"):
        m = re.search(r"-(\d+)$", last[0]["code"])
        if m:
            next_num = int(m.group(1)) + 1
    return f"{prefix}{next_num:03d}"


async def _generate_portal_code() -> str:
    """10 haneli, karışmayan karakterlerden rastgele portal takip kodu üret."""
    for _ in range(20):
        code = "".join(secrets.choice(PORTAL_CODE_ALPHABET) for _ in range(PORTAL_CODE_LENGTH))
        existing = await db.customers.find_one({"portal_code": code}, {"_id": 0, "id": 1})
        if not existing:
            return code
    raise HTTPException(500, "Portal kodu üretilemedi, tekrar deneyin")


@router.get("/customers")
async def list_customers(
    q: Optional[str] = None,
    include_archived: bool = False,
    user=Depends(get_current_user),
):
    query = {}
    if not include_archived:
        query["archived"] = {"$ne": True}
    if q:
        q_safe = re.escape(q.strip())
        query["$or"] = [
            {"name": {"$regex": q_safe, "$options": "i"}},
            {"phone": {"$regex": q_safe, "$options": "i"}},
            {"code": {"$regex": q_safe, "$options": "i"}},
        ]
    items = await db.customers.find(query, {"_id": 0}).sort("name", 1).to_list(1000)
    roles = await get_user_roles(user)
    if not (is_yonetim(roles) or "plan" in roles):
        items = [_strip_portal_fields(c) for c in items]
    return items


@router.get("/customers/search")
async def search_customers(q: str = "", limit: int = 20, user=Depends(get_current_user)):
    """Combobox için hızlı arama. Min karakter: 1."""
    if not q or len(q.strip()) < 1:
        # Boş arama → son kullanılan 10 müşteri
        items = await db.customers.find(
            {"archived": {"$ne": True}, "last_order_at": {"$ne": None}},
            {"_id": 0},
        ).sort("last_order_at", -1).limit(limit).to_list(limit)
    else:
        q_safe = re.escape(q.strip())
        items = await db.customers.find(
            {
                "archived": {"$ne": True},
                "$or": [
                    {"name": {"$regex": q_safe, "$options": "i"}},
                    {"phone": {"$regex": q_safe, "$options": "i"}},
                    {"code": {"$regex": q_safe, "$options": "i"}},
                ],
            },
            {"_id": 0},
        ).sort("name", 1).limit(limit).to_list(limit)
    roles = await get_user_roles(user)
    if not (is_yonetim(roles) or "plan" in roles):
        items = [_strip_portal_fields(c) for c in items]
    return items


@router.get("/customers/{customer_id}")
async def get_customer(customer_id: str, user=Depends(get_current_user)):
    c = await db.customers.find_one({"id": customer_id}, {"_id": 0})
    if not c:
        raise HTTPException(404, "Müşteri bulunamadı")
    roles = await get_user_roles(user)
    if not (is_yonetim(roles) or "plan" in roles):
        c = _strip_portal_fields(c)
    return c


@router.get("/customers/{customer_id}/jobs")
async def customer_jobs(
    customer_id: str,
    status: Optional[str] = None,
    limit: int = 100,
    user=Depends(get_current_user),
):
    """Müşterinin işleri — aktif (status != completed) ve geçmiş ayrılır."""
    query = {"customer_id": customer_id}
    if status:
        query["status"] = status
    projection = {"_id": 0, "thumb_url": 0}
    roles = await get_user_roles(user)
    if not is_yonetim(roles):
        for field in PRICING_FIELDS:
            projection[field] = 0
    jobs = await db.jobs.find(query, projection).sort("created_at", -1).limit(limit).to_list(limit)
    active = [j for j in jobs if j.get("status") not in ("completed", "cancelled")]
    history = [j for j in jobs if j.get("status") in ("completed", "cancelled")]
    return {
        "customer_id": customer_id,
        "active": active,
        "history": history,
        "total_jobs": len(jobs),
        "active_count": len(active),
        "history_count": len(history),
    }


@router.post("/customers")
async def create_customer(payload: dict = Body(...), user=Depends(get_current_user)):
    name = (payload.get("name") or "").strip()
    if not name:
        raise HTTPException(400, "Müşteri adı zorunlu")
    # İsim dedupe — case-insensitive
    existing = await db.customers.find_one(
        {"name": {"$regex": f"^{re.escape(name)}$", "$options": "i"}, "archived": {"$ne": True}},
        {"_id": 0},
    )
    roles = await get_user_roles(user)
    caller_can_see_portal_code = is_yonetim(roles) or "plan" in roles
    if existing:
        # Aynı isimde varsa onu geri döndür (idempotent + UX dostu)
        if not caller_can_see_portal_code:
            existing = _strip_portal_fields(existing)
        return {**existing, "_existed": True}
    code = await _generate_code()
    portal_code = await _generate_portal_code()
    customer = Customer(
        name=name,
        phone=(payload.get("phone") or "").strip() or None,
        address=(payload.get("address") or "").strip() or None,
        email=(payload.get("email") or "").strip() or None,
        notes=(payload.get("notes") or "").strip() or None,
        code=code,
        portal_code=portal_code,
        portal_code_updated_at=_now_iso(),
    )
    doc = customer.model_dump()
    await db.customers.insert_one(doc)
    # _id'yi temizle (insert_one ekledi, JSON serializable değil)
    doc.pop("_id", None)
    try:
        await log_audit(user.get("username"), "create", "customer", name, f"Kod: {code or '—'}")
    except Exception:
        pass
    if not caller_can_see_portal_code:
        doc = _strip_portal_fields(doc)
    return doc


@router.put("/customers/{customer_id}")
async def update_customer(customer_id: str, payload: dict = Body(...), user=Depends(get_current_user)):
    update = {}
    for f in ("name", "phone", "address", "email", "notes"):
        if f in payload:
            v = payload[f]
            update[f] = (v.strip() if isinstance(v, str) else v) or None
    if not update:
        raise HTTPException(400, "Güncellenecek alan yok")
    update["updated_at"] = _now_iso()
    res = await db.customers.update_one({"id": customer_id}, {"$set": update})
    if res.matched_count == 0:
        raise HTTPException(404, "Müşteri bulunamadı")
    c = await db.customers.find_one({"id": customer_id}, {"_id": 0})
    try:
        await log_audit(user.get("username"), "update", "customer", c.get("name", customer_id), f"Guncellenen: {', '.join(update.keys())}")
    except Exception:
        pass
    roles = await get_user_roles(user)
    if not (is_yonetim(roles) or "plan" in roles):
        c = _strip_portal_fields(c)
    return c


def _require_yonetim_or_plan(roles):
    if not (is_yonetim(roles) or "plan" in roles):
        raise HTTPException(403, "Bu işlem için yetkiniz yok")


@router.delete("/customers/{customer_id}")
async def archive_customer(customer_id: str, user=Depends(get_current_user)):
    roles = await get_user_roles(user)
    _require_yonetim_or_plan(roles)
    res = await db.customers.update_one(
        {"id": customer_id},
        {"$set": {"archived": True, "updated_at": _now_iso()}},
    )
    if res.matched_count == 0:
        raise HTTPException(404, "Müşteri bulunamadı")
    try:
        await log_audit(user.get("username"), "delete", "customer", customer_id, "Arsivlendi")
    except Exception:
        pass
    return {"ok": True, "archived": True}


@router.post("/customers/{customer_id}/portal-code/regenerate")
async def regenerate_portal_code(customer_id: str, user=Depends(get_current_user)):
    """Portal takip kodunu yenile — eski kod anında geçersiz olur (yonetim/plan)."""
    roles = await get_user_roles(user)
    _require_yonetim_or_plan(roles)
    customer = await db.customers.find_one({"id": customer_id}, {"_id": 0})
    if not customer:
        raise HTTPException(404, "Müşteri bulunamadı")
    new_code = await _generate_portal_code()
    now = _now_iso()
    await db.customers.update_one(
        {"id": customer_id},
        {"$set": {"portal_code": new_code, "portal_code_updated_at": now}},
    )
    try:
        await log_audit(user.get("username"), "update", "customer", customer.get("name", customer_id), "Portal kodu yenilendi")
    except Exception:
        pass
    return {"portal_code": new_code, "portal_code_updated_at": now}


# ============== JOB hook helpers ===========
# Aşağıdaki fonksiyonlar jobs.py'den çağrılarak customer aggregate'ini günceller.

async def on_job_created(customer_id: Optional[str]):
    """Yeni iş geldi → müşterinin total_jobs ve last_order_at'ını güncelle."""
    if not customer_id:
        return
    await db.customers.update_one(
        {"id": customer_id},
        {"$inc": {"total_jobs": 1}, "$set": {"last_order_at": _now_iso()}},
    )


async def on_job_deleted(customer_id: Optional[str]):
    if not customer_id:
        return
    await db.customers.update_one(
        {"id": customer_id},
        {"$inc": {"total_jobs": -1}},
    )
