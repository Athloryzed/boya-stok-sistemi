"""
Günlük Yemek Menüsü API.

- GET  /api/menu/today   → Bugünün menüsü (auth gerekmez, herkese açık)
- GET  /api/menu?date=YYYY-MM-DD → Belirli günün menüsü (auth gerekmez)
- GET  /api/menu/upcoming → Bu hafta+gelecek menüler (yönetim listeleme için)
- POST /api/menu          → Menü ekle/güncelle (yönetim)
- DELETE /api/menu/{date} → Menü sil (yönetim)
"""
from fastapi import APIRouter, HTTPException, Body, Depends
from typing import Optional
from datetime import datetime, timezone, timedelta

from database import db
from models import DailyMenu
from auth import get_current_user, MANAGEMENT_PASSWORD
from services.audit import log_audit

router = APIRouter()


def _today_str() -> str:
    # Türkiye saati ile gün anahtarı (UTC+3)
    return (datetime.now(timezone.utc) + timedelta(hours=3)).strftime("%Y-%m-%d")


# ==================== KAMU (login gerektirmez) ====================

@router.get("/menu/today")
async def get_today_menu():
    """Bugünün yemek menüsü — tüm ziyaretçiler için açık."""
    today = _today_str()
    menu = await db.daily_menu.find_one({"date": today}, {"_id": 0})
    if not menu:
        return {"date": today, "items": [], "notes": None, "exists": False}
    menu["exists"] = True
    return menu


@router.get("/menu")
async def get_menu_by_date(date: Optional[str] = None):
    """Belirli günün menüsü."""
    if not date:
        date = _today_str()
    menu = await db.daily_menu.find_one({"date": date}, {"_id": 0})
    if not menu:
        return {"date": date, "items": [], "notes": None, "exists": False}
    menu["exists"] = True
    return menu


# ==================== YÖNETİM (auth gerektirir) ====================

@router.get("/menu/upcoming")
async def get_upcoming_menus(data: dict = Depends(get_current_user)):
    """Son 7 gün + gelecek 30 gün menüleri (yönetim listeleme)."""
    today_dt = datetime.now(timezone.utc) + timedelta(hours=3)
    start = (today_dt - timedelta(days=7)).strftime("%Y-%m-%d")
    end = (today_dt + timedelta(days=30)).strftime("%Y-%m-%d")
    menus = await db.daily_menu.find(
        {"date": {"$gte": start, "$lte": end}}, {"_id": 0}
    ).sort("date", -1).to_list(60)
    return menus


@router.post("/menu")
async def upsert_menu(data: dict = Body(...), user: dict = Depends(get_current_user)):
    """Menü ekle/güncelle (aynı tarihte upsert)."""
    date = (data.get("date") or "").strip()
    items = data.get("items", [])
    notes = (data.get("notes") or "").strip() or None

    if not date or len(date) != 10:
        raise HTTPException(status_code=400, detail="Tarih (YYYY-MM-DD) zorunlu")
    if not isinstance(items, list):
        raise HTTPException(status_code=400, detail="items bir liste olmalı")
    items = [str(i).strip() for i in items if str(i).strip()]
    if not items:
        raise HTTPException(status_code=400, detail="En az bir yemek eklemelisiniz")

    user_name = user.get("display_name") or user.get("username") or "Yönetim"
    existing = await db.daily_menu.find_one({"date": date}, {"_id": 0})

    if existing:
        await db.daily_menu.update_one(
            {"date": date},
            {"$set": {
                "items": items, "notes": notes,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        await log_audit(user_name, "update", "daily_menu", date, f"Menü güncellendi: {len(items)} öğe")
    else:
        menu = DailyMenu(date=date, items=items, notes=notes, created_by=user_name)
        await db.daily_menu.insert_one(menu.model_dump())
        await log_audit(user_name, "create", "daily_menu", date, f"Yeni menü: {len(items)} öğe")

    updated = await db.daily_menu.find_one({"date": date}, {"_id": 0})
    return {"menu": updated, "message": f"{date} menüsü kaydedildi"}


@router.delete("/menu/{date}")
async def delete_menu(date: str, user: dict = Depends(get_current_user)):
    """Belirli günün menüsünü sil."""
    res = await db.daily_menu.delete_one({"date": date})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Menü bulunamadı")
    user_name = user.get("display_name") or user.get("username") or "Yönetim"
    await log_audit(user_name, "delete", "daily_menu", date)
    return {"message": f"{date} menüsü silindi"}
