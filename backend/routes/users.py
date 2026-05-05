from fastapi import APIRouter, HTTPException, Body, Depends, Request
from typing import Optional
from datetime import datetime, timezone
from slowapi import Limiter
from slowapi.util import get_remote_address
from rate_limit_utils import get_real_client_ip

from database import db
from models import User
from auth import hash_password, verify_password, create_token, get_current_user, MANAGEMENT_PASSWORD
from services.audit import log_audit

router = APIRouter()
limiter = Limiter(key_func=get_real_client_ip)


VALID_ROLES = ["operator", "plan", "depo", "sofor"]


@router.post("/users")
async def create_user(data: dict = Body(...), current_user: dict = Depends(get_current_user)):
    """Yeni kullanıcı oluştur (yetkili). 'role' (tek) veya 'roles' (çoklu) kabul eder."""
    username = data.get("username", "").strip()
    password = data.get("password", "")
    roles_input = data.get("roles")
    role = data.get("role", "")
    display_name = data.get("display_name", username)
    phone = data.get("phone", "")

    # Çoklu rol desteği: roles listesi varsa onu kullan, yoksa tek rol fallback
    if roles_input and isinstance(roles_input, list) and len(roles_input) > 0:
        roles = [r for r in roles_input if r in VALID_ROLES]
        if not roles:
            raise HTTPException(status_code=400, detail="En az bir geçerli rol gerekli")
        primary_role = roles[0]
    elif role:
        if role not in VALID_ROLES:
            raise HTTPException(status_code=400, detail="Geçersiz rol")
        roles = [role]
        primary_role = role
    else:
        raise HTTPException(status_code=400, detail="Rol zorunludur")

    if not username or not password:
        raise HTTPException(status_code=400, detail="Kullanıcı adı ve şifre zorunludur")

    existing = await db.users.find_one({"username": username, "is_active": True})
    if existing:
        raise HTTPException(status_code=400, detail="Bu kullanıcı adı zaten kullanılıyor")

    user = User(
        username=username, password=hash_password(password),
        role=primary_role, roles=roles,
        display_name=display_name, phone=phone
    )
    await db.users.insert_one(user.model_dump())
    await log_audit(current_user.get("display_name", "Yonetim"), "create", "user", username, f"Roller: {', '.join(roles)}")

    user_dict = user.model_dump()
    user_dict.pop("password", None)
    return user_dict


@router.patch("/users/{user_id}/roles")
async def update_user_roles(user_id: str, data: dict = Body(...), current_user: dict = Depends(get_current_user)):
    """Bir kullanıcının rollerini güncelle (yetkili). 'roles' listesi bekler."""
    roles_input = data.get("roles")
    if not isinstance(roles_input, list) or len(roles_input) == 0:
        raise HTTPException(status_code=400, detail="Roller listesi boş olamaz")
    roles = [r for r in roles_input if r in VALID_ROLES]
    if not roles:
        raise HTTPException(status_code=400, detail="En az bir geçerli rol gerekli")

    user = await db.users.find_one({"id": user_id, "is_active": True}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")

    await db.users.update_one(
        {"id": user_id},
        {"$set": {"roles": roles, "role": roles[0]}}
    )
    await log_audit(current_user.get("display_name", "Yonetim"), "update", "user", user["username"], f"Roller: {', '.join(roles)}")
    return {"success": True, "roles": roles, "role": roles[0]}


@router.get("/users")
async def get_users(role: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    """Kullanıcıları listele (yetkili). role param'ı roles[] içinde de arar."""
    query = {"is_active": True}
    if role:
        # Role bir role veya roles listesi içinde bulunsun
        query["$or"] = [{"role": role}, {"roles": role}]
    users = await db.users.find(query, {"_id": 0, "password": 0}).sort("created_at", -1).to_list(200)
    # Eski kullanıcılarda roles boşsa [role] olarak döndür (geriye uyumluluk)
    for u in users:
        if not u.get("roles"):
            u["roles"] = [u.get("role", "")] if u.get("role") else []
    return users


@router.post("/users/login")
@limiter.limit("120/minute")
async def user_login(request: Request, data: dict = Body(...)):
    """Kullanıcı girişi - bcrypt + JWT. Çoklu rol desteği: role, user.roles içinde olmalı."""
    username = data.get("username", "").strip()
    password = data.get("password", "")
    expected_role = data.get("role")

    user = await db.users.find_one({"username": username, "is_active": True}, {"_id": 0})

    if not user:
        raise HTTPException(status_code=401, detail="Geçersiz kullanıcı adı veya şifre")

    if not verify_password(password, user.get("password", "")):
        raise HTTPException(status_code=401, detail="Geçersiz kullanıcı adı veya şifre")

    # Kullanıcının rolleri (roles varsa onu, yoksa [role])
    user_roles = user.get("roles") or ([user.get("role")] if user.get("role") else [])

    # expected_role verildiyse: hem tek role hem roles listesinde kontrol et
    if expected_role and expected_role not in user_roles:
        raise HTTPException(status_code=403, detail=f"Bu sayfaya erişim yetkiniz yok. Yetkiniz: {', '.join(user_roles)}")

    # Giriş için kullanılan rol (expected_role varsa o, yoksa primary role)
    login_role = expected_role if expected_role else user.get("role", user_roles[0] if user_roles else "")

    token = create_token(user["id"], user["username"], login_role, user.get("display_name", ""))

    user.pop("password", None)
    # Frontend için roles garantisi
    if not user.get("roles"):
        user["roles"] = user_roles
    return {**user, "token": token, "login_role": login_role}


@router.post("/management/login")
@limiter.limit("60/minute")
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
