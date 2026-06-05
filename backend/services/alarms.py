"""
Kritik Aksiyon Alarm Servisi — `audit_alarms` koleksiyonuna yazar.
Şimdilik sadece kayıt — SMS/Telegram bildirim eklenecek (kullanıcı tarafından
ileride istenebilir). Yönetim panelinden listelenebilir.
"""
import logging
import uuid
from datetime import datetime, timezone
from typing import Optional

from database import db

logger = logging.getLogger(__name__)

# Önem derecesi: info | warning | critical
SEVERITY_LEVELS = {"info", "warning", "critical"}

CRITICAL_ACTIONS = {
    "user_delete", "user_create", "user_role_change",
    "driver_delete", "driver_create",
    "mass_delete", "backup_run", "backup_delete", "backup_restore",
    "password_change", "lockout_trigger", "auth_failed_5x",
    "shift_force_close", "job_force_delete",
    "config_change",
}


async def raise_alarm(
    action: str,
    actor: str = "system",
    entity_type: str = "",
    entity_id: str = "",
    severity: str = "warning",
    metadata: Optional[dict] = None,
):
    """Audit alarm kaydı oluştur. SMS/Telegram'a şu an gönderim YAPMIYORUZ."""
    try:
        if severity not in SEVERITY_LEVELS:
            severity = "warning"
        doc = {
            "id": str(uuid.uuid4()),
            "action": action,
            "actor": actor,
            "entity_type": entity_type,
            "entity_id": entity_id,
            "severity": severity,
            "metadata": metadata or {},
            "acknowledged": False,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.audit_alarms.insert_one(doc)
        logger.info("Audit alarm: %s by %s (%s)", action, actor, severity)
    except Exception as e:
        logger.error("Audit alarm yazılamadı: %s", e)
