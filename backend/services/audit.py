import logging
from database import db
from models import AuditLog

logger = logging.getLogger(__name__)


async def log_audit(user: str, action: str, entity_type: str, entity_name: str = "", details: str = ""):
    """Kullanici hareket logu kaydet"""
    try:
        log = AuditLog(user=user, action=action, entity_type=entity_type, entity_name=entity_name, details=details)
        await db.audit_logs.insert_one(log.model_dump())
    except Exception as e:
        logger.error(f"Audit log error: {e}")
