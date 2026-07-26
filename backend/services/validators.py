"""
Strict Input Validators (Madde 10).

Login ve kullanıcı oluşturma akışları için Pydantic v2 modelleri.
- Username: 2-32 karakter, sadece a-z 0-9 _ . - karakterleri.
- Password: en az 6, en çok 128 karakter (mevcut zayıf şifrelerle uyumlu).
- Phone: opsiyonel, sadece rakam/boşluk/+/-/() — 7-20 karakter.
- Telegram/SMS gibi alanların formatı strict.
"""
import re
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

USERNAME_RE = re.compile(r"^[A-Za-z0-9_.\-]{2,32}$")
PHONE_RE = re.compile(r"^[0-9+\-\s()]{7,20}$")
ROLE_WHITELIST = {"operator", "plan", "depo", "sofor", "yonetim", "boyaci"}


def _clean(v: Optional[str]) -> Optional[str]:
    if v is None:
        return v
    return v.strip() if isinstance(v, str) else v


class LoginRequest(BaseModel):
    model_config = ConfigDict(extra="ignore", str_strip_whitespace=True)
    username: str = Field(..., min_length=2, max_length=64)
    password: str = Field(..., min_length=1, max_length=256)
    role: Optional[str] = None

    @field_validator("role")
    @classmethod
    def _role_check(cls, v):
        if v is None or v == "":
            return None
        if v not in ROLE_WHITELIST:
            raise ValueError("Geçersiz rol")
        return v


class DriverLoginRequest(BaseModel):
    model_config = ConfigDict(extra="ignore", str_strip_whitespace=True)
    name: str = Field(..., min_length=2, max_length=64)
    password: str = Field(..., min_length=1, max_length=256)


class PasswordRequest(BaseModel):
    """Şifre-only girişler (yönetim/dashboard)."""
    model_config = ConfigDict(extra="ignore", str_strip_whitespace=True)
    password: str = Field(..., min_length=1, max_length=256)


class CreateUserRequest(BaseModel):
    model_config = ConfigDict(extra="ignore", str_strip_whitespace=True)
    username: str = Field(..., min_length=2, max_length=32)
    password: str = Field(..., min_length=6, max_length=128)
    roles: Optional[List[str]] = None
    role: Optional[str] = None
    display_name: Optional[str] = Field(None, max_length=128)
    phone: Optional[str] = Field(None, max_length=32)

    @field_validator("username")
    @classmethod
    def _username_check(cls, v):
        if not USERNAME_RE.match(v):
            raise ValueError("Kullanıcı adı 2-32 karakter, sadece harf/rakam/_.- olabilir")
        return v

    @field_validator("phone")
    @classmethod
    def _phone_check(cls, v):
        v = _clean(v)
        if v is None or v == "":
            return None
        if not PHONE_RE.match(v):
            raise ValueError("Telefon formatı geçersiz (sadece 0-9 + - ( ) boşluk)")
        return v

    @field_validator("roles")
    @classmethod
    def _roles_check(cls, v):
        if v is None:
            return v
        bad = [r for r in v if r not in ROLE_WHITELIST]
        if bad:
            raise ValueError(f"Geçersiz roller: {bad}")
        return v

    @field_validator("role")
    @classmethod
    def _role_check(cls, v):
        if v is None or v == "":
            return None
        if v not in ROLE_WHITELIST:
            raise ValueError("Geçersiz rol")
        return v


class CreateDriverRequest(BaseModel):
    model_config = ConfigDict(extra="ignore", str_strip_whitespace=True)
    name: str = Field(..., min_length=2, max_length=64)
    password: str = Field(..., min_length=6, max_length=128)
    phone: Optional[str] = Field(None, max_length=32)

    @field_validator("phone")
    @classmethod
    def _phone_check(cls, v):
        v = _clean(v)
        if v is None or v == "":
            return None
        if not PHONE_RE.match(v):
            raise ValueError("Telefon formatı geçersiz")
        return v


class UpdateUserRolesRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")
    roles: List[str] = Field(..., min_length=1)

    @field_validator("roles")
    @classmethod
    def _roles_check(cls, v):
        bad = [r for r in v if r not in ROLE_WHITELIST]
        if bad:
            raise ValueError(f"Geçersiz roller: {bad}")
        return v
