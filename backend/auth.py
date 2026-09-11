import os
import time
import bcrypt
import jwt
import uuid
from datetime import datetime, timezone, timedelta
from fastapi import HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from pathlib import Path

from database import db

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

JWT_SECRET = os.environ['JWT_SECRET']
JWT_REFRESH_SECRET = os.environ.get('JWT_REFRESH_SECRET', JWT_SECRET + '_refresh')
JWT_ALGORITHM = "HS256"
# Access token: 30 dakika (kısa ömür, sık yenilenir)
ACCESS_TOKEN_MINUTES = int(os.environ.get('ACCESS_TOKEN_MINUTES', '30'))
# Refresh token: 7 gün
REFRESH_TOKEN_DAYS = int(os.environ.get('REFRESH_TOKEN_DAYS', '7'))
# Geriye dönük uyumluluk için eski sabit (24 saat) — kullanılmayacak ama referans kalsın
JWT_EXPIRY_HOURS = 24
MANAGEMENT_PASSWORD = os.environ.get('MANAGEMENT_PASSWORD', 'buse11993')
DASHBOARD_PASSWORD = os.environ.get('DASHBOARD_PASSWORD', 'buse4')

security = HTTPBearer(auto_error=False)


def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode('utf-8'), hashed.encode('utf-8'))
    except Exception:
        return False


def _build_payload(user_id: str, username: str, role: str, display_name: str, token_type: str, ttl: timedelta) -> dict:
    now = datetime.now(timezone.utc)
    return {
        "sub": user_id,
        "username": username,
        "role": role,
        "display_name": display_name,
        "type": token_type,
        "jti": str(uuid.uuid4()),
        "exp": now + ttl,
        "iat": now,
    }


def create_access_token(user_id: str, username: str, role: str, display_name: str = "") -> str:
    payload = _build_payload(user_id, username, role, display_name, "access",
                             timedelta(minutes=ACCESS_TOKEN_MINUTES))
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def create_refresh_token(user_id: str, username: str, role: str, display_name: str = "") -> str:
    payload = _build_payload(user_id, username, role, display_name, "refresh",
                             timedelta(days=REFRESH_TOKEN_DAYS))
    return jwt.encode(payload, JWT_REFRESH_SECRET, algorithm=JWT_ALGORITHM)


def create_token_pair(user_id: str, username: str, role: str, display_name: str = "") -> dict:
    """Hem access hem refresh token üret + ms cinsinden expires_in."""
    return {
        "token": create_access_token(user_id, username, role, display_name),
        "refresh_token": create_refresh_token(user_id, username, role, display_name),
        "access_expires_in": ACCESS_TOKEN_MINUTES * 60,
        "refresh_expires_in": REFRESH_TOKEN_DAYS * 86400,
    }


# Geriye dönük uyumluluk: eski `create_token` aynı erişim token'ını döner
def create_token(user_id: str, username: str, role: str, display_name: str = "") -> str:
    return create_access_token(user_id, username, role, display_name)


def decode_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        # Sadece access token'lar burada kabul edilir (refresh veya camera gibi
        # dar amaçlı token'lar normal korumalı endpoint'lere sızmasın). "type"
        # alanı taşımayan eski token'lar (2026-06-05 öncesi) geriye dönük
        # uyumluluk için access kabul edilir — o tarihten önce üretilmiş hiçbir
        # token zaten bugün süresi dolmadan ayakta kalamaz, ama yine de düşülüyor.
        token_type = payload.get("type")
        if token_type is not None and token_type != "access":
            raise HTTPException(status_code=401, detail="Bu token bu işlem için kullanılamaz")
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Oturum süresi doldu")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Geçersiz token")


# Kamera erişimi: iframe ile yüklenen kamera stream istekleri Authorization
# header taşıyamaz, bu yüzden nginx auth_request bu amaca özel kısa ömürlü
# bir HttpOnly çerez üzerinden doğrulama yapar.
CAMERA_COOKIE_NAME = "camera_session"
CAMERA_COOKIE_MINUTES = int(os.environ.get('CAMERA_COOKIE_MINUTES', '5'))
CAMERA_COOKIE_SECURE = os.environ.get('CAMERA_COOKIE_SECURE', 'true').lower() != 'false'


def create_camera_token(user_id: str, username: str, role: str, display_name: str = "") -> str:
    payload = _build_payload(user_id, username, role, display_name, "camera",
                             timedelta(minutes=CAMERA_COOKIE_MINUTES))
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_camera_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "camera":
            raise HTTPException(status_code=401, detail="Geçersiz kamera oturumu")
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Kamera oturumu süresi doldu")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Geçersiz kamera oturumu")


def decode_refresh_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, JWT_REFRESH_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Geçersiz refresh token tipi")
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Refresh token süresi doldu, lütfen yeniden giriş yapın")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Geçersiz refresh token")


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if not credentials:
        raise HTTPException(status_code=401, detail="Kimlik doğrulama gerekli")
    return decode_token(credentials.credentials)


async def get_optional_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if not credentials:
        return None
    try:
        return decode_token(credentials.credentials)
    except Exception:
        return None


# ==================== ROL ÇÖZÜMLEME (çoklu rol + yonetim/management alias) ====================

ALL_PANEL_ROLES = ["operator", "plan", "depo", "sofor", "yonetim", "boyaci"]
# "management" = /management/login sabit şifre girişinin sentetik rolü — "yonetim" ile eşdeğer.
YONETIM_ALIASES = ("yonetim", "management")

# get_user_roles için basit in-memory TTL cache: nginx auth_request gibi çok sık
# çağrılan yerlerde her istekte db.users sorgusu yapılmasın. Rol değişikliği en
# geç TTL süresi kadar gecikmeli yansır (kabul edilebilir bulundu).
_ROLES_CACHE_TTL_SECONDS = 60
_roles_cache: dict = {}  # user_id -> (roles, expires_at_monotonic)


async def get_user_roles(current_user: dict) -> list:
    """current_user (JWT payload) için gerçek rol listesini döner.

    JWT'nin kendisi sadece tekil `role` claim'i taşır; çoklu rol desteği için
    current_user["sub"] (kullanıcı id'si) ile db.users'tan tam kullanıcı
    dokümanı çekilip oradaki `roles` dizisi kullanılır. Kullanıcı bulunamazsa
    (örn. /management/login ile gelen sentetik token, gerçek bir db.users
    kaydına karşılık gelmez) JWT'nin tekil `role` alanına düşülür.

    Yonetim/management rolü varsa — /users/login'deki mevcut admin muafiyeti
    mantığıyla tutarlı olarak — tüm panel rolleri otomatik eklenir.
    """
    user_id = current_user.get("sub")
    now = time.monotonic()
    if user_id:
        cached = _roles_cache.get(user_id)
        if cached and cached[1] > now:
            return cached[0]

    user_doc = await db.users.find_one({"id": user_id}, {"_id": 0, "roles": 1, "role": 1}) if user_id else None
    if user_doc:
        roles = user_doc.get("roles") or ([user_doc.get("role")] if user_doc.get("role") else [])
    else:
        role = current_user.get("role")
        roles = [role] if role else []

    if any(r in YONETIM_ALIASES for r in roles):
        # set() sırası deterministik değil (hash randomization) — aynı kullanıcı
        # farklı girişlerde farklı sırada roller görebiliyordu. ALL_PANEL_ROLES
        # sırasına göre sabitleniyor; bilinmeyen/eski rol kodları (örn. "management")
        # sona, alfabetik sırayla ekleniyor.
        combined = set(roles) | {"yonetim"} | set(ALL_PANEL_ROLES)
        ordered = [r for r in ALL_PANEL_ROLES if r in combined]
        extras = sorted(r for r in combined if r not in ALL_PANEL_ROLES)
        roles = ordered + extras

    if user_id:
        _roles_cache[user_id] = (roles, now + _ROLES_CACHE_TTL_SECONDS)
    return roles


def is_yonetim(roles) -> bool:
    """Rol listesinde yonetim veya management (alias) var mı?"""
    return any(r in YONETIM_ALIASES for r in (roles or []))


async def require_yonetim(current_user: dict) -> None:
    """Sadece yonetim/management erişebilsin — yetkisizse 403 fırlatır."""
    roles = await get_user_roles(current_user)
    if not is_yonetim(roles):
        raise HTTPException(status_code=403, detail="Sadece Yönetim erişebilir")
