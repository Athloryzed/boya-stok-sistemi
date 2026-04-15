from fastapi import APIRouter, HTTPException, Body
from typing import Optional
import logging

from database import db
from models import MachineMessage
from websocket_manager import ws_manager
from services.notifications import send_notification_to_operators

router = APIRouter()


@router.post("/messages", response_model=MachineMessage)
async def send_message(data: dict = Body(...)):
    """Plan veya Yönetim'den makineye mesaj gönder"""
    machine_id = data.get("machine_id")
    machine_name = data.get("machine_name")
    sender_role = data.get("sender_role")
    sender_name = data.get("sender_name", sender_role.title())
    message_text = data.get("message")

    if not all([machine_id, sender_role, message_text]):
        raise HTTPException(status_code=400, detail="Eksik bilgi")

    message = MachineMessage(
        machine_id=machine_id, machine_name=machine_name or "",
        sender_role=sender_role, sender_name=sender_name, message=message_text
    )

    await db.machine_messages.insert_one(message.model_dump())

    await ws_manager.broadcast({
        "type": "new_message",
        "data": {
            "machine_id": machine_id, "machine_name": machine_name,
            "sender_role": sender_role, "sender_name": sender_name,
            "message": message_text, "created_at": message.created_at
        }
    })

    try:
        await send_notification_to_operators(
            machine_id=machine_id,
            title=f"Yeni Mesaj - {sender_name}",
            body=message_text[:100],
            data={"type": "new_message", "machine_id": machine_id}
        )
    except Exception as e:
        logging.error(f"FCM notification error for message: {e}")

    return message


@router.get("/messages/{machine_id}")
async def get_machine_messages(machine_id: str, limit: int = 50):
    messages = await db.machine_messages.find(
        {"machine_id": machine_id}, {"_id": 0}
    ).sort("created_at", -1).to_list(limit)
    return list(reversed(messages))


@router.get("/messages/{machine_id}/unread")
async def get_unread_messages(machine_id: str):
    count = await db.machine_messages.count_documents({
        "machine_id": machine_id, "is_read": False
    })
    return {"unread_count": count}


@router.put("/messages/{machine_id}/mark-read")
async def mark_messages_read(machine_id: str):
    result = await db.machine_messages.update_many(
        {"machine_id": machine_id, "is_read": False},
        {"$set": {"is_read": True}}
    )
    return {"marked_read": result.modified_count}


@router.get("/messages/all/incoming")
async def get_all_incoming_messages(limit: int = 100):
    messages = await db.machine_messages.find(
        {"sender_role": "operator"}, {"_id": 0}
    ).sort("created_at", -1).to_list(limit)
    return messages


@router.get("/messages/all/unread-count")
async def get_all_unread_count():
    count = await db.machine_messages.count_documents({
        "sender_role": "operator", "is_read": False
    })
    return {"unread_count": count}


@router.put("/messages/mark-read/{message_id}")
async def mark_single_message_read(message_id: str):
    result = await db.machine_messages.update_one(
        {"id": message_id}, {"$set": {"is_read": True}}
    )
    return {"success": result.modified_count > 0}
