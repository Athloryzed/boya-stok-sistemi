"""
Audit log servisi — append-only / immutable.

Özellikler:
- Her log satırı bir önceki logun `entry_hash`'ini içerir → tamper-evident hash chain.
- `audit_logs.update_*` ve `audit_logs.delete_*` API üzerinden ASLA çağrılmaz
  (sadece bu modüldeki helper'lardan insert yapılır).
- Yönetim endpointi `/admin/audit/verify` chain bütünlüğünü kontrol eder.
"""
import hashlib
import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Optional

from database import db

logger = logging.getLogger(__name__)


def _compute_hash(prev_hash: str, payload: dict) -> str:
    """SHA-256(prev_hash || canonical_json(payload))."""
    canonical = json.dumps(payload, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
    digest = hashlib.sha256()
    digest.update(prev_hash.encode("utf-8"))
    digest.update(canonical.encode("utf-8"))
    return digest.hexdigest()


async def _get_last_hash() -> str:
    last = await db.audit_logs.find_one(
        {}, {"_id": 0, "entry_hash": 1}, sort=[("created_at", -1)]
    )
    if last and last.get("entry_hash"):
        return last["entry_hash"]
    return "0" * 64  # genesis


def _as_text(value) -> str:
    """Audit alanları her zaman string olmalı (dict/list gelirse UI'da React #31 hatası olur)."""
    if value is None:
        return ""
    if isinstance(value, str):
        return value
    if isinstance(value, (dict, list, tuple)):
        return json.dumps(value, ensure_ascii=False, default=str)
    return str(value)


async def log_audit(
    user: str,
    action: str,
    entity_type: str,
    entity_name: str = "",
    details: str = "",
    metadata: Optional[dict] = None,
):
    """Append-only audit log yazımı + hash chain."""
    try:
        prev_hash = await _get_last_hash()
        now_iso = datetime.now(timezone.utc).isoformat()
        payload = {
            "id": str(uuid.uuid4()),
            "user": _as_text(user),
            "action": _as_text(action),
            "entity_type": _as_text(entity_type),
            "entity_name": _as_text(entity_name),
            "details": _as_text(details),
            "metadata": metadata or {},
            "created_at": now_iso,
            "prev_hash": prev_hash,
        }
        entry_hash = _compute_hash(prev_hash, payload)
        payload["entry_hash"] = entry_hash
        await db.audit_logs.insert_one(payload)
    except Exception as e:
        logger.error("Audit log error: %s", e)


async def verify_chain(limit: int = 5000) -> dict:
    """Audit log hash zincirini doğrula. Bozulma varsa ilk bozuk kaydı döner."""
    cursor = db.audit_logs.find(
        {}, {"_id": 0},
    ).sort("created_at", 1).limit(limit)
    prev_hash = "0" * 64
    count = 0
    async for doc in cursor:
        count += 1
        rec_prev = doc.get("prev_hash", "")
        rec_hash = doc.get("entry_hash", "")
        # Eski (chain'siz) kayıtları atla — geçiş için tolerans
        if not rec_hash:
            prev_hash = rec_hash or prev_hash
            continue
        if rec_prev != prev_hash:
            return {"valid": False, "broken_at": doc.get("id"), "reason": "prev_hash_mismatch",
                    "expected_prev": prev_hash, "got_prev": rec_prev, "scanned": count}
        recomputed = _compute_hash(prev_hash, {k: v for k, v in doc.items() if k not in ("entry_hash",)})
        if recomputed != rec_hash:
            return {"valid": False, "broken_at": doc.get("id"), "reason": "hash_mismatch",
                    "expected": recomputed, "got": rec_hash, "scanned": count}
        prev_hash = rec_hash
    return {"valid": True, "scanned": count, "last_hash": prev_hash}
