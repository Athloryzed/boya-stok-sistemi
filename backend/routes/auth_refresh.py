"""
Auth Refresh & Logout endpoint'leri.
- POST /api/auth/refresh: refresh token al, yeni access token (+ rotated refresh) döndür.
- POST /api/auth/logout: refresh JTI'yi blacklist'e ekle (sliding logout).
- GET /api/auth/me: mevcut user payload'unu döner (UI için pratik).
"""
import logging
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, Body, Depends, Request
from slowapi import Limiter

from rate_limit_utils import get_real_client_ip
from auth import (
    decode_refresh_token,
    create_token_pair,
    get_current_user,
    REFRESH_TOKEN_DAYS,
)
from database import db

logger = logging.getLogger(__name__)

router = APIRouter()
limiter = Limiter(key_func=get_real_client_ip)


async def _is_jti_revoked(jti: str) -> bool:
    if not jti:
        return False
    doc = await db.revoked_tokens.find_one({"_id": jti}, {"_id": 1})
    return doc is not None


async def _revoke_jti(jti: str, reason: str = "logout"):
    if not jti:
        return
    expires_at = datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_DAYS + 1)
    await db.revoked_tokens.update_one(
        {"_id": jti},
        {"$set": {"reason": reason, "revoked_at": datetime.now(timezone.utc).isoformat(),
                  "expires_at": expires_at}},
        upsert=True,
    )


@router.post("/auth/refresh")
@limiter.limit("60/minute")
async def refresh_token(request: Request, data: dict = Body(...)):
    """Refresh token ile yeni access (+ rotated refresh) token üret."""
    rt = (data.get("refresh_token") or "").strip()
    if not rt:
        raise HTTPException(status_code=400, detail="refresh_token gerekli")
    payload = decode_refresh_token(rt)
    jti = payload.get("jti", "")
    if await _is_jti_revoked(jti):
        raise HTTPException(status_code=401, detail="Refresh token iptal edilmiş, lütfen yeniden giriş yapın")

    # Token rotation: eski refresh JTI'yi blacklist'e al, yeni çift üret
    await _revoke_jti(jti, reason="rotated")

    new_pair = create_token_pair(
        user_id=payload.get("sub", ""),
        username=payload.get("username", ""),
        role=payload.get("role", ""),
        display_name=payload.get("display_name", ""),
    )
    return new_pair


@router.post("/auth/logout")
async def logout(data: dict = Body(default={}), current_user: dict = Depends(get_current_user)):
    """Refresh token JTI'yi iptal eder (frontend access'i de localStorage'dan siler)."""
    rt = (data.get("refresh_token") or "").strip()
    if rt:
        try:
            payload = decode_refresh_token(rt)
            await _revoke_jti(payload.get("jti", ""), reason="logout")
        except Exception:
            # Geçersiz refresh — sessiz geç
            pass
    return {"success": True}


@router.get("/auth/me")
async def me(current_user: dict = Depends(get_current_user)):
    """JWT payload'unu döner — UI istek başında ne durumda olduğunu öğrenebilir."""
    return {
        "id": current_user.get("sub"),
        "username": current_user.get("username"),
        "role": current_user.get("role"),
        "display_name": current_user.get("display_name", ""),
        "exp": current_user.get("exp"),
    }
