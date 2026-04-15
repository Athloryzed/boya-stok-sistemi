from fastapi import APIRouter, HTTPException, Body, Depends, Request
from typing import Optional
from datetime import datetime, timezone
from slowapi import Limiter
from slowapi.util import get_remote_address

from database import db
from models import User
from auth import hash_password, verify_password, create_token, get_current_user, MANAGEMENT_PASSWORD
from services.audit import log_audit

router = APIRouter()
limiter = Limiter(key_func=get_remote_address)


@router.post("/users")
async def create_user(data: dict = Body(...), current_user: dict = Depends(get_current_user)):
    """Yeni kullanıcı oluştur (yetkili)"""
    username = data.get("username", "").strip()
    password = data.get("password", "")
    role = data.get("role", "")
    display_name = data.get("display_name", username)
    phone = data.get("phone", "")

    if not username or not password or not role:
        raise HTTPException(status_code=400, detail="Kullanıcı adı, şifre ve rol zorunludur")

    if role not in ["operator", "plan", "depo", "sofor"]:
        raise HTTPException(status_code=400, detail="Geçersiz rol")

    existing = await db.users.find_one({"username": username, "is_active": True})
    if existing:
        raise HTTPException(status_code=400, detail="Bu kullanıcı adı zaten kullanılıyor")

    user = User(
        username=username, password=hash_password(password),
        role=role, display_name=display_name, phone=phone
    )
    await db.users.insert_one(user.model_dump())
    await log_audit(current_user.get("display_name", "Yonetim"), "create", "user", username, f"Rol: {role}")

    user_dict = user.model_dump()
    user_dict.pop("password", None)
    return user_dict


@router.get("/users")
async def get_users(role: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    """Kullanıcıları listele (yetkili)"""
    query = {"is_active": True}
    if role:
        query["role"] = role
    users = await db.users.find(query, {"_id": 0, "password": 0}).sort("created_at", -1).to_list(200)
    return users


@router.post("/users/login")
@limiter.limit("10/minute")
async def user_login(request: Request, data: dict = Body(...)):
    """Kullanıcı girişi - bcrypt + JWT"""
    username = data.get("username", "").strip()
    password = data.get("password", "")
    expected_role = data.get("role")

    user = await db.users.find_one({"username": username, "is_active": True}, {"_id": 0})

    if not user:
        raise HTTPException(status_code=401, detail="Geçersiz kullanıcı adı veya şifre")

    if not verify_password(password, user.get("password", "")):
        raise HTTPException(status_code=401, detail="Geçersiz kullanıcı adı veya şifre")

    if expected_role and user["role"] != expected_role:
        raise HTTPException(status_code=403, detail=f"Bu sayfaya erişim yetkiniz yok. Yetkiniz: {user['role']}")

    token = create_token(user["id"], user["username"], user["role"], user.get("display_name", ""))

    user.pop("password", None)
    return {**user, "token": token}


@router.post("/management/login")
@limiter.limit("10/minute")
async def management_login(request: Request, data: dict = Body(...)):
    """Yönetim paneli girişi - JWT"""
    password = data.get("password", "")
    if password != MANAGEMENT_PASSWORD:
        raise HTTPException(status_code=401, detail="Yanlış şifre")

    token = create_token("management", "yonetim", "management", "Yönetim")
    return {"success": True, "token": token, "role": "management", "display_name": "Yönetim"}


@router.delete("/users/{user_id}")
async def delete_user(user_id: str, current_user: dict = Depends(get_current_user)):
    """Kullanıcı sil (yetkili)"""
    result = await db.users.update_one({"id": user_id}, {"$set": {"is_active": False}})
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
    return {"success": True}


@router.put("/users/{user_id}/location")
async def update_user_location(user_id: str, data: dict = Body(...)):
    """Kullanıcı konumunu güncelle (şoförler için)"""
    lat = data.get("lat")
    lng = data.get("lng")
    await db.users.update_one(
        {"id": user_id},
        {"$set": {
            "current_location_lat": lat,
            "current_location_lng": lng,
            "location_updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    return {"success": True}


@router.get("/users/drivers/locations")
async def get_driver_locations():
    """Tüm şoförlerin konumlarını getir"""
    drivers = await db.users.find({
        "role": "sofor", "is_active": True,
        "current_location_lat": {"$ne": None}
    }, {"_id": 0, "password": 0}).to_list(100)
    return drivers
