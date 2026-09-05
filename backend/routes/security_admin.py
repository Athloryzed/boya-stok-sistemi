"""
Güvenlik Yönetim Endpoint'leri (Madde 1 audit verify, 6 lockout listesi, 8 alarmlar).
Sadece `yonetim` rolü erişebilir.
"""
import logging
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends, Query

from auth import get_current_user, require_yonetim as _require_yonetim
from database import db
from services.audit import verify_chain

logger = logging.getLogger(__name__)
router = APIRouter(dependencies=[Depends(get_current_user)])


@router.get("/admin/audit/verify")
async def admin_audit_verify(current_user: dict = Depends(get_current_user), limit: int = 5000):
    """Audit log hash chain bütünlüğünü doğrular."""
    await _require_yonetim(current_user)
    return await verify_chain(limit=limit)


@router.get("/admin/alarms")
async def list_alarms(
    current_user: dict = Depends(get_current_user),
    severity: Optional[str] = Query(None),
    acknowledged: Optional[bool] = Query(None),
    limit: int = 100,
):
    await _require_yonetim(current_user)
    q = {}
    if severity:
        q["severity"] = severity
    if acknowledged is not None:
        q["acknowledged"] = acknowledged
    items = await db.audit_alarms.find(q, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    return {"items": items, "count": len(items)}


@router.post("/admin/alarms/{alarm_id}/ack")
async def ack_alarm(alarm_id: str, current_user: dict = Depends(get_current_user)):
    await _require_yonetim(current_user)
    result = await db.audit_alarms.update_one(
        {"id": alarm_id},
        {"$set": {"acknowledged": True, "acknowledged_by": current_user.get("display_name", "yonetim")}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Alarm bulunamadı")
    return {"success": True}


@router.get("/admin/lockouts")
async def list_lockouts(current_user: dict = Depends(get_current_user)):
    await _require_yonetim(current_user)
    items = await db.account_lockouts.find({}, {}).sort("locked_until", -1).to_list(500)
    # _id (string) → account
    for it in items:
        it["account"] = it.pop("_id", "")
    return {"items": items, "count": len(items)}


@router.delete("/admin/lockouts/{account}")
async def clear_lockout(account: str, current_user: dict = Depends(get_current_user)):
    await _require_yonetim(current_user)
    await db.account_lockouts.delete_one({"_id": account})
    await db.login_attempts.delete_many({"account": account})
    return {"success": True}


@router.get("/admin/security/status")
async def security_status(current_user: dict = Depends(get_current_user)):
    """Tek bakışta güvenlik durumu — Yönetim panelinde gösterilecek."""
    await _require_yonetim(current_user)
    chain = await verify_chain(limit=2000)
    alarm_count = await db.audit_alarms.count_documents({"acknowledged": False})
    lockout_count = await db.account_lockouts.count_documents({})
    failed_24h = await db.login_attempts.count_documents({})
    return {
        "audit_chain": chain,
        "unacknowledged_alarms": alarm_count,
        "active_lockouts": lockout_count,
        "failed_login_attempts": failed_24h,
    }
