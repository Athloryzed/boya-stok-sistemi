import os
import bcrypt
import jwt
import uuid
from datetime import datetime, timezone, timedelta
from fastapi import HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from pathlib import Path

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
        # Refresh token'la korumalı endpoint'e girilmesin
        if payload.get("type") == "refresh":
            raise HTTPException(status_code=401, detail="Refresh token doğrudan kullanılamaz")
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Oturum süresi doldu")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Geçersiz token")


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
