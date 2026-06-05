from fastapi import APIRouter, HTTPException, Body, Depends, Request
from typing import Optional
from datetime import datetime, timezone
from slowapi import Limiter

from rate_limit_utils import get_real_client_ip
from database import db
from models import User
from auth import (
    hash_password, verify_password,
    create_access_token, create_token_pair,
    get_current_user, MANAGEMENT_PASSWORD,
)
from services.audit import log_audit
from services.account_lockout import assert_not_locked, record_failure, record_success
from services.alarms import raise_alarm
from services.crypto_utils import encrypt_pii, decrypt_pii
from services.validators import (
    LoginRequest, CreateUserRequest, UpdateUserRolesRequest, PasswordRequest,
)

router = APIRouter()
limiter = Limiter(key_func=get_real_client_ip)


VALID_ROLES = ["operator", "plan", "depo", "sofor", "yonetim"]
ALL_PANEL_ROLES = ["operator", "plan", "depo", "sofor", "yonetim"]


def _public_user(user: dict) -> dict:
    """Hassas alanları temizle + PII decrypt."""
    user.pop("password", None)
    user.pop("totp_secret", None)
    user.pop("backup_codes", None)
    if "phone" in user:
        user["phone"] = decrypt_pii(user.get("phone"))
    return user


@router.post("/users")
async def create_user(data: CreateUserRequest = Body(...), current_user: dict = Depends(get_current_user)):
    """Yeni kullanıcı oluştur (yetkili). 'role' (tek) veya 'roles' (çoklu) kabul eder."""
    roles_input = data.roles
    role = data.role

    if roles_input:
        roles = [r for r in roles_input if r in VALID_ROLES]
        if not roles:
            raise HTTPException(status_code=400, detail="En az bir geçerli rol gerekli")
        primary_role = roles[0]
    elif role:
        roles = [role]
        primary_role = role
    else:
        raise HTTPException(status_code=400, detail="Rol zorunludur")

    existing = await db.users.find_one({"username": data.username, "is_active": True})
    if existing:
        raise HTTPException(status_code=400, detail="Bu kullanıcı adı zaten kullanılıyor")

    user = User(
        username=data.username,
        password=hash_password(data.password),
        role=primary_role,
        roles=roles,
        display_name=data.display_name or data.username,
        phone=encrypt_pii(data.phone or ""),
    )
    await db.users.insert_one(user.model_dump())
    actor = current_user.get("display_name", "Yonetim")
    await log_audit(actor, "create", "user", data.username, f"Roller: {', '.join(roles)}")
    await raise_alarm("user_create", actor=actor, entity_type="user", entity_id=user.id,
                      severity="info", metadata={"roles": roles})

    return _public_user(user.model_dump())


@router.patch("/users/{user_id}/roles")
async def update_user_roles(user_id: str, data: UpdateUserRolesRequest = Body(...), current_user: dict = Depends(get_current_user)):
    """Bir kullanıcının rollerini güncelle (yetkili)."""
    roles = data.roles
    user = await db.users.find_one({"id": user_id, "is_active": True}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")

    await db.users.update_one(
        {"id": user_id},
        {"$set": {"roles": roles, "role": roles[0]}}
    )
    actor = current_user.get("display_name", "Yonetim")
    await log_audit(actor, "update", "user", user["username"], f"Roller: {', '.join(roles)}")
    await raise_alarm("user_role_change", actor=actor, entity_type="user",
                      entity_id=user_id, severity="warning",
                      metadata={"new_roles": roles, "username": user["username"]})
    return {"success": True, "roles": roles, "role": roles[0]}


@router.get("/users")
async def get_users(role: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    """Kullanıcıları listele (yetkili). role param'ı roles[] içinde de arar."""
    query = {"is_active": True}
    if role:
        query["$or"] = [{"role": role}, {"roles": role}]
    users = await db.users.find(query, {"_id": 0, "password": 0, "totp_secret": 0, "backup_codes": 0}).sort("created_at", -1).to_list(200)
    for u in users:
        if not u.get("roles"):
            u["roles"] = [u.get("role", "")] if u.get("role") else []
        # PII decrypt — frontend için
        if "phone" in u:
            u["phone"] = decrypt_pii(u.get("phone"))
    return users


@router.post("/users/login")
@limiter.limit("120/minute")
async def user_login(request: Request, data: LoginRequest = Body(...)):
    """Kullanıcı girişi - bcrypt + JWT (refresh token dahil)."""
    username = data.username
    password = data.password
    expected_role = data.role

    # Per-account lockout kontrolü (madde 6)
    await assert_not_locked(username)

    user = await db.users.find_one({"username": username, "is_active": True}, {"_id": 0})
    ip = get_real_client_ip(request) if hasattr(request, "client") else ""

    if not user:
        await record_failure(username, ip=ip, reason="user_not_found")
        from services.account_lockout import is_locked
        locked, _ = await is_locked(username)
        if locked:
            await raise_alarm("auth_failed_5x", actor=username, entity_type="user",
                              entity_id="", severity="critical",
                              metadata={"ip": ip, "reason": "user_not_found"})
        raise HTTPException(status_code=401, detail="Geçersiz kullanıcı adı veya şifre")

    if not verify_password(password, user.get("password", "")):
        await record_failure(username, ip=ip, reason="invalid_password")
        # Eşik aşıldıysa alarm yükselt
        from services.account_lockout import is_locked
        locked, _ = await is_locked(username)
        if locked:
            await raise_alarm("auth_failed_5x", actor=username, entity_type="user",
                              entity_id=user["id"], severity="critical",
                              metadata={"ip": ip})
        raise HTTPException(status_code=401, detail="Geçersiz kullanıcı adı veya şifre")

    # Başarılı — sayaçları sıfırla
    await record_success(username)

    user_roles = user.get("roles") or ([user.get("role")] if user.get("role") else [])
    is_admin = "yonetim" in user_roles
    effective_roles = list(set(user_roles + ALL_PANEL_ROLES)) if is_admin else user_roles

    if expected_role and not is_admin and expected_role not in user_roles:
        raise HTTPException(status_code=403, detail=f"Bu sayfaya erişim yetkiniz yok. Yetkiniz: {', '.join(user_roles)}")

    login_role = expected_role if expected_role else (user.get("role") or (user_roles[0] if user_roles else ""))
    pair = create_token_pair(user["id"], user["username"], login_role, user.get("display_name", ""))

    # last_login_at güncelle
    await db.users.update_one({"id": user["id"]}, {"$set": {"last_login_at": datetime.now(timezone.utc).isoformat()}})

    user = _public_user(user)
    user["roles"] = effective_roles
    return {**user, **pair, "login_role": login_role}


@router.post("/management/login")
@limiter.limit("60/minute")
async def management_login(request: Request, data: PasswordRequest = Body(...)):
    """Yönetim paneli girişi - JWT (refresh dahil)."""
    # Sabit hesap için lockout key = "__management__"
    await assert_not_locked("__management__")
    ip = get_real_client_ip(request) if hasattr(request, "client") else ""

    if data.password != MANAGEMENT_PASSWORD:
        await record_failure("__management__", ip=ip, reason="invalid_password")
        from services.account_lockout import is_locked
        locked, _ = await is_locked("__management__")
        if locked:
            await raise_alarm("auth_failed_5x", actor="__management__",
                              entity_type="management_login", severity="critical",
                              metadata={"ip": ip})
        raise HTTPException(status_code=401, detail="Yanlış şifre")

    await record_success("__management__")
    pair = create_token_pair("management", "yonetim", "management", "Yönetim")
    return {"success": True, **pair, "role": "management", "display_name": "Yönetim"}


@router.delete("/users/{user_id}")
async def delete_user(user_id: str, current_user: dict = Depends(get_current_user)):
    """Kullanıcı sil (yetkili) — soft delete."""
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "username": 1})
    result = await db.users.update_one({"id": user_id}, {"$set": {"is_active": False}})
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
    actor = current_user.get("display_name", "Yonetim")
    await log_audit(actor, "delete", "user", (user or {}).get("username", user_id))
    await raise_alarm("user_delete", actor=actor, entity_type="user",
                      entity_id=user_id, severity="critical",
                      metadata={"username": (user or {}).get("username", "")})
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
    }, {"_id": 0, "password": 0, "totp_secret": 0, "backup_codes": 0}).to_list(100)
    for d in drivers:
        if "phone" in d:
            d["phone"] = decrypt_pii(d.get("phone"))
    return drivers
