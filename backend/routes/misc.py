from fastapi import APIRouter, HTTPException, Body
from datetime import datetime, timezone
import logging

from database import db

router = APIRouter()


@router.get("/audit-logs")
async def get_audit_logs(limit: int = 100, skip: int = 0):
    """Kullanici hareket loglarini getir"""
    logs = await db.audit_logs.find({}, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.audit_logs.count_documents({})
    return {"logs": logs, "total": total}


@router.post("/managers/register")
async def register_manager(data: dict = Body(...)):
    """Yöneticiyi bildirim için kaydet"""
    manager_id = data.get("manager_id")
    if not manager_id:
        raise HTTPException(status_code=400, detail="manager_id required")

    await db.active_managers.update_one(
        {"manager_id": manager_id},
        {"$set": {"manager_id": manager_id, "registered_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True
    )
    logging.info(f"Manager registered: {manager_id}")
    return {"status": "registered", "manager_id": manager_id}


@router.post("/notifications/register-token")
async def register_fcm_token(data: dict = Body(...)):
    """FCM token'ı kaydet"""
    token = data.get("token")
    user_type = data.get("user_type", "manager")
    user_id = data.get("user_id", "")

    if not token:
        raise HTTPException(status_code=400, detail="token required")

    await db.fcm_tokens.update_one(
        {"token": token},
        {"$set": {
            "token": token, "user_type": user_type,
            "user_id": user_id,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }},
        upsert=True
    )
    logging.info(f"FCM token registered for {user_type}: {token[:20]}...")
    return {"status": "registered"}
