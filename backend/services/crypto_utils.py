"""
PII Şifreleme Yardımcısı — Fernet (AES-128 CBC + HMAC-SHA256) ile telefon, adres
gibi hassas alanları symmetric şifreleme.

Anahtar yönetimi:
- `PII_ENCRYPTION_KEY` env'de bulunmalı (base64 URL-safe Fernet key).
- Yoksa ilk import'ta otomatik üretilip /app/backend/.pii_key dosyasına kaydedilir
  (production'da bu dosya .env'e elle taşınmalıdır).
- Token formatı: "enc:v1:<fernet_token>" — düz metin kayıtlardan ayırt etmek için.
  Bu sayede mevcut veriyle backward-compat kalır (decrypt sadece "enc:v1:" prefix'liyse).
"""
import os
import logging
from pathlib import Path
from typing import Optional

from cryptography.fernet import Fernet, InvalidToken

logger = logging.getLogger(__name__)

ENC_PREFIX = "enc:v1:"
_KEY_FILE = Path(__file__).resolve().parent.parent / ".pii_key"


def _load_or_create_key() -> bytes:
    raw = os.environ.get("PII_ENCRYPTION_KEY", "").strip()
    if raw:
        return raw.encode("utf-8")
    # Local fallback (development/preview) — production'da .env'e yazılmalı
    if _KEY_FILE.exists():
        return _KEY_FILE.read_bytes().strip()
    new_key = Fernet.generate_key()
    try:
        _KEY_FILE.write_bytes(new_key)
        _KEY_FILE.chmod(0o600)
        logger.warning(
            "PII_ENCRYPTION_KEY oluşturuldu ve %s dosyasına yazıldı. "
            "Lütfen prod ortamında bu değeri .env'e taşıyın: PII_ENCRYPTION_KEY=<key>",
            _KEY_FILE,
        )
    except Exception as e:
        logger.error("PII key dosyasına yazılamadı: %s", e)
    return new_key


_KEY = _load_or_create_key()
_FERNET = Fernet(_KEY)


def encrypt_pii(value: Optional[str]) -> Optional[str]:
    """Düz metin değeri Fernet ile şifreler. Boş/None aynen döner. Zaten şifreli ise dokunmaz."""
    if value is None or value == "":
        return value
    if isinstance(value, str) and value.startswith(ENC_PREFIX):
        return value  # idempotent
    try:
        token = _FERNET.encrypt(value.encode("utf-8")).decode("utf-8")
        return ENC_PREFIX + token
    except Exception as e:
        logger.error("PII encrypt error: %s", e)
        return value


def decrypt_pii(value: Optional[str]) -> Optional[str]:
    """Şifreli değeri çözer. Düz metin (prefix yok) ise aynen döner. Çözülemezse orijinali döner."""
    if value is None or value == "":
        return value
    if not isinstance(value, str):
        return value
    if not value.startswith(ENC_PREFIX):
        return value  # düz metin — geriye dönük uyumluluk
    try:
        token = value[len(ENC_PREFIX):]
        plain = _FERNET.decrypt(token.encode("utf-8")).decode("utf-8")
        return plain
    except InvalidToken:
        logger.warning("PII decrypt: geçersiz token, ham değer dönülüyor")
        return value
    except Exception as e:
        logger.error("PII decrypt error: %s", e)
        return value


def mask_pii(value: Optional[str], visible: int = 4) -> str:
    """Telefon/adres gibi alanları görüntüleme için maskeler. 5xx ****1234."""
    plain = decrypt_pii(value) or ""
    if not plain:
        return ""
    if len(plain) <= visible:
        return "*" * len(plain)
    return ("*" * (len(plain) - visible)) + plain[-visible:]
