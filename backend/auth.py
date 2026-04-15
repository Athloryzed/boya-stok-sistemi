import os
import bcrypt
import jwt
from datetime import datetime, timezone, timedelta
from fastapi import HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALGORITHM = "HS256"
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


def create_token(user_id: str, username: str, role: str, display_name: str = "") -> str:
    payload = {
        "sub": user_id,
        "username": username,
        "role": role,
        "display_name": display_name,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRY_HOURS),
        "iat": datetime.now(timezone.utc)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Oturum süresi doldu")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Geçersiz token")


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if not credentials:
        raise HTTPException(status_code=401, detail="Kimlik doğrulama gerekli")
    return decode_token(credentials.credentials)


async def get_optional_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Token varsa doğrula, yoksa None dön (opsiyonel auth)"""
    if not credentials:
        return None
    try:
        return decode_token(credentials.credentials)
    except Exception:
        return None
