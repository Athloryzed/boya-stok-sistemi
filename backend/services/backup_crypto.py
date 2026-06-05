"""
Backup AES-256 Şifreleme + Daily Verification (Madde 5 & 11).

Şifreleme: AES-256-GCM (cryptography.hazmat). Anahtar:
- `BACKUP_ENCRYPTION_KEY` env: base64 32 byte.
- Yoksa otomatik üretilip /app/backend/.backup_key dosyasına yazılır.

Çıktı formatı: `backup_<ts>.archive.gz.enc`:
  [12 byte nonce][16 byte tag][şifreli içerik]

Doğrulama:
- SHA-256 checksum hesaplanır ve `.sha256` dosyasına yazılır.
- `restore_dryrun`: ENC dosyayı DEC eder, geçici dosyaya yazar, mongodump arşivini
  validate eder (gzip stream parse). Bozulma varsa exception fırlatır.
"""
import base64
import hashlib
import logging
import os
from pathlib import Path
from typing import Tuple

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

logger = logging.getLogger(__name__)

_KEY_FILE = Path(__file__).resolve().parent.parent / ".backup_key"


def _load_or_create_key() -> bytes:
    raw = os.environ.get("BACKUP_ENCRYPTION_KEY", "").strip()
    if raw:
        try:
            key = base64.b64decode(raw)
            if len(key) == 32:
                return key
        except Exception:
            pass
        logger.warning("BACKUP_ENCRYPTION_KEY geçersiz, otomatik üretim deneniyor")
    if _KEY_FILE.exists():
        try:
            return base64.b64decode(_KEY_FILE.read_text().strip())
        except Exception:
            pass
    new_key = AESGCM.generate_key(bit_length=256)
    try:
        _KEY_FILE.write_text(base64.b64encode(new_key).decode("utf-8"))
        _KEY_FILE.chmod(0o600)
        logger.warning(
            "BACKUP_ENCRYPTION_KEY otomatik üretildi → %s. "
            "Lütfen .env'e taşıyın: BACKUP_ENCRYPTION_KEY=<base64>",
            _KEY_FILE,
        )
    except Exception as e:
        logger.error("Backup key dosyasına yazılamadı: %s", e)
    return new_key


def _key() -> bytes:
    return _load_or_create_key()


def encrypt_file(plain_path: Path) -> Path:
    """AES-256-GCM ile dosyayı şifreler. .enc uzantısı ile kaydeder."""
    if not plain_path.exists():
        raise FileNotFoundError(str(plain_path))
    enc_path = plain_path.with_suffix(plain_path.suffix + ".enc")
    aes = AESGCM(_key())
    nonce = os.urandom(12)
    data = plain_path.read_bytes()
    ct = aes.encrypt(nonce, data, None)
    enc_path.write_bytes(nonce + ct)
    return enc_path


def decrypt_file(enc_path: Path, out_path: Path) -> Path:
    """ENC dosyayı çözer ve `out_path`'a yazar."""
    data = enc_path.read_bytes()
    if len(data) < 13:
        raise ValueError("Şifreli dosya çok kısa")
    nonce, ct = data[:12], data[12:]
    aes = AESGCM(_key())
    plain = aes.decrypt(nonce, ct, None)
    out_path.write_bytes(plain)
    return out_path


def write_checksum(path: Path) -> Path:
    """SHA-256 checksum dosyası oluştur."""
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    ck_path = path.with_suffix(path.suffix + ".sha256")
    ck_path.write_text(f"{h.hexdigest()}  {path.name}\n")
    return ck_path


def verify_checksum(path: Path, expected_path: Path) -> Tuple[bool, str]:
    """SHA-256'yı doğrula. Beklenen file format: '<hex>  <filename>'."""
    if not expected_path.exists():
        return False, "checksum dosyası yok"
    expected = expected_path.read_text().split()[0]
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    actual = h.hexdigest()
    return actual == expected, actual


def restore_dryrun(enc_path: Path) -> dict:
    """
    Şifreli yedeği DEC eder, gzip stream'inin valid olduğunu kontrol eder
    (içeriği diske yazmaz — RAM'de).
    """
    import gzip
    import io
    if not enc_path.exists():
        return {"success": False, "error": "ENC dosyası yok"}
    try:
        data = enc_path.read_bytes()
        if len(data) < 13:
            return {"success": False, "error": "ENC çok kısa"}
        nonce, ct = data[:12], data[12:]
        aes = AESGCM(_key())
        plain = aes.decrypt(nonce, ct, None)
        # gzip stream geçerli mi? İlk N byte oku
        with gzip.GzipFile(fileobj=io.BytesIO(plain)) as gz:
            head = gz.read(4096)
        size_mb = round(len(plain) / 1024 / 1024, 2)
        return {"success": True, "decrypted_size_mb": size_mb, "head_bytes": len(head)}
    except Exception as e:
        logger.exception("restore_dryrun failed")
        return {"success": False, "error": str(e)}
