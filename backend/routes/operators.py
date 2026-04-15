from fastapi import APIRouter, HTTPException, Body, Depends
from datetime import datetime, timezone

from database import db
from models import OperatorSession
from auth import get_current_user

router = APIRouter(dependencies=[Depends(get_current_user)])


@router.post("/operator/session")
async def create_or_get_session(data: dict = Body(...)):
    """Operatör oturumu oluştur veya mevcut oturumu getir"""
    device_id = data.get("device_id")
    operator_name = data.get("operator_name")
    machine_id = data.get("machine_id")
    machine_name = data.get("machine_name")

    if not device_id:
        raise HTTPException(status_code=400, detail="device_id gerekli")

    today_end = datetime.now(timezone.utc).replace(hour=23, minute=59, second=59)

    existing = await db.operator_sessions.find_one({
        "device_id": device_id,
        "expires_at": {"$gt": datetime.now(timezone.utc).isoformat()}
    }, {"_id": 0})

    if existing and not operator_name:
        await db.operator_sessions.update_one(
            {"id": existing["id"]},
            {"$set": {"last_active": datetime.now(timezone.utc).isoformat()}}
        )
        return existing

    if operator_name:
        session = OperatorSession(
            device_id=device_id, operator_name=operator_name,
            machine_id=machine_id, machine_name=machine_name,
            expires_at=today_end.isoformat()
        )
        await db.operator_sessions.delete_many({"device_id": device_id})
        await db.operator_sessions.insert_one(session.model_dump())
        return session.model_dump()

    return None


@router.get("/operator/session/{device_id}")
async def get_operator_session(device_id: str):
    session = await db.operator_sessions.find_one({
        "device_id": device_id,
        "expires_at": {"$gt": datetime.now(timezone.utc).isoformat()}
    }, {"_id": 0})
    return session


@router.delete("/operator/session/{device_id}")
async def delete_operator_session(device_id: str):
    result = await db.operator_sessions.delete_many({"device_id": device_id})
    return {"deleted": result.deleted_count}
