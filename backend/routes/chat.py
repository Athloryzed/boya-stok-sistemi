"""
Chat / Messenger API routes.
"""
from fastapi import APIRouter, HTTPException, Depends, Body, UploadFile, File, Query
from typing import List, Optional
from datetime import datetime, timezone, timedelta
from pathlib import Path
import logging
import uuid

from database import db
from models_chat import (
    Conversation, ChatMessage, MessageRead, UserPresence,
    PushSubscription, QUICK_TEMPLATES, SEED_CHANNELS,
)
from websocket_chat import ws_chat
from services.auto_chat import ensure_seed_channels, ensure_machine_channel, SYSTEM_USER_ID
from services.web_push import get_vapid_public_key, send_push_to_users
from auth import get_current_user

router = APIRouter(prefix="/chat", dependencies=[Depends(get_current_user)])
logger = logging.getLogger(__name__)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


async def _normalize_user(payload: dict) -> dict:
    """JWT payload'ı DB'den zenginleştirilmiş user dict'e çevir."""
    uid = payload.get("sub") or payload.get("user_id") or payload.get("id")
    if not uid:
        raise HTTPException(status_code=401, detail="Geçersiz token")
    db_user = await db.users.find_one({"id": uid}, {"_id": 0, "id": 1, "username": 1, "display_name": 1, "role": 1, "roles": 1})
    if not db_user:
        # Fallback: token bilgisinden
        return {
            "id": uid,
            "username": payload.get("username") or "",
            "display_name": payload.get("display_name") or payload.get("username") or "",
            "role": payload.get("role") or "operator",
            "roles": [payload.get("role")] if payload.get("role") else [],
        }
    db_user["roles"] = db_user.get("roles") or ([db_user.get("role")] if db_user.get("role") else [])
    return db_user


def _user_roles(user: dict) -> List[str]:
    return user.get("roles") or ([user.get("role")] if user.get("role") else [])


async def get_chat_user(payload: dict = Depends(get_current_user)) -> dict:
    """JWT payload'ı normalize edilmiş user dict'e çevir (id + roles[])."""
    return await _normalize_user(payload)


# ───────────────────────────────────────────
# YARDIMCI: Auto-join (yeni kullanıcı login olunca rol kanallarına otomatik katılır)
# ───────────────────────────────────────────
async def _auto_join_channels(user_id: str, user_roles: List[str]):
    convs = await db.conversations.find(
        {"type": "group", "is_system": True}, {"_id": 0, "id": 1, "auto_join_roles": 1, "participants": 1}
    ).to_list(50)
    for conv in convs:
        if any(r in conv.get("auto_join_roles", []) for r in user_roles):
            if user_id not in conv.get("participants", []):
                await db.conversations.update_one(
                    {"id": conv["id"]},
                    {"$addToSet": {"participants": user_id}}
                )


# ───────────────────────────────────────────
# 1) Conversations listesi
# ───────────────────────────────────────────
@router.get("/conversations")
async def list_conversations(user: dict = Depends(get_chat_user)):
    """Kullanıcının erişebildiği tüm conversations + unread count."""
    user_id = user["id"]
    user_roles = _user_roles(user)
    # Otomatik kanallara katıl (eksikse)
    await _auto_join_channels(user_id, user_roles)

    convs = await db.conversations.find(
        {"participants": user_id}, {"_id": 0}
    ).sort("last_message_at", -1).to_list(500)

    # Her conversation için unread sayısı
    reads = await db.message_reads.find(
        {"conversation_id": {"$in": [c["id"] for c in convs]}, "user_id": user_id},
        {"_id": 0, "conversation_id": 1, "last_read_at": 1}
    ).to_list(2000)
    read_map = {r["conversation_id"]: r["last_read_at"] for r in reads}

    enriched = []
    for c in convs:
        last_read = read_map.get(c["id"], "1970-01-01T00:00:00+00:00")
        unread = await db.chat_messages.count_documents({
            "conversation_id": c["id"],
            "created_at": {"$gt": last_read},
            "sender_id": {"$ne": user_id},
            "deleted_at": None,
        })
        c["unread_count"] = unread
        # DM için karşı tarafın bilgisi
        if c.get("type") == "dm":
            other_id = next((p for p in c.get("participants", []) if p != user_id), None)
            if other_id:
                other = await db.users.find_one({"id": other_id}, {"_id": 0, "id": 1, "username": 1, "display_name": 1, "role": 1, "roles": 1})
                if other:
                    c["other_user"] = other
                    if not c.get("name"):
                        c["name"] = other.get("display_name") or other.get("username")
                c["other_online"] = ws_chat.is_online(other_id) if other_id else False
        enriched.append(c)

    return enriched


# ───────────────────────────────────────────
# 2) Mesaj listesi
# ───────────────────────────────────────────
@router.get("/conversations/{conv_id}/messages")
async def list_messages(conv_id: str, limit: int = Query(50, ge=1, le=200), before: Optional[str] = None, user: dict = Depends(get_chat_user)):
    conv = await db.conversations.find_one({"id": conv_id, "participants": user["id"]}, {"_id": 0})
    if not conv:
        raise HTTPException(status_code=404, detail="Konuşma bulunamadı veya erişim yok")
    query = {"conversation_id": conv_id, "deleted_at": None}
    if before:
        query["created_at"] = {"$lt": before}
    messages = await db.chat_messages.find(query, {"_id": 0}).sort("created_at", -1).to_list(limit)
    return list(reversed(messages))


# ───────────────────────────────────────────
# 3) Mesaj gönder
# ───────────────────────────────────────────
@router.post("/conversations/{conv_id}/messages")
async def send_message(conv_id: str, data: dict = Body(...), user: dict = Depends(get_chat_user)):
    conv = await db.conversations.find_one({"id": conv_id, "participants": user["id"]}, {"_id": 0})
    if not conv:
        raise HTTPException(status_code=404, detail="Konuşma bulunamadı veya erişim yok")

    text = (data.get("text") or "").strip()
    msg_type = data.get("msg_type") or "text"
    attachments = data.get("attachments") or []
    reply_to = data.get("reply_to")
    if not text and not attachments:
        raise HTTPException(status_code=400, detail="Boş mesaj gönderilemez")

    primary_role = (_user_roles(user) or ["operator"])[0]
    msg = ChatMessage(
        conversation_id=conv_id,
        sender_id=user["id"],
        sender_name=user.get("display_name") or user.get("username") or "Kullanıcı",
        sender_role=primary_role,
        text=text,
        msg_type=msg_type,
        attachments=attachments,
        reply_to=reply_to,
    )
    await db.chat_messages.insert_one(msg.model_dump())
    await db.conversations.update_one(
        {"id": conv_id},
        {"$set": {
            "last_message_at": msg.created_at,
            "last_message_preview": text[:140],
            "last_message_sender_id": msg.sender_id,
            "last_message_sender_name": msg.sender_name,
        }}
    )

    # Otomatik okundu (kendi gönderdiği)
    await db.message_reads.update_one(
        {"conversation_id": conv_id, "user_id": user["id"]},
        {"$set": {"last_read_message_id": msg.id, "last_read_at": msg.created_at}},
        upsert=True,
    )

    # WebSocket broadcast
    payload = {
        "type": "new_message",
        "conversation_id": conv_id,
        "conversation": {
            "id": conv["id"], "name": conv.get("name"), "type": conv.get("type"),
            "icon": conv.get("icon"), "channel_key": conv.get("channel_key"),
        },
        "message": msg.model_dump(),
    }
    await ws_chat.send_to_users(conv.get("participants", []), payload)

    # Web Push: online olmayan katılımcılara
    offline = [p for p in conv.get("participants", []) if p != user["id"] and not ws_chat.is_online(p)]
    if offline:
        conv_name = conv.get("name") or "Buse Kâğıt"
        push_title = (f"💬 {conv_name}" if conv.get("type") != "dm" else f"💬 {msg.sender_name}")
        try:
            await send_push_to_users(
                offline,
                {
                    "title": push_title, "body": text[:120] or "Yeni mesaj",
                    "icon": "/icon-192.png", "badge": "/icon-192.png",
                    "tag": f"conv-{conv_id}",
                    "data": {"conversation_id": conv_id, "message_id": msg.id, "url": "/"},
                },
                db,
            )
        except Exception as e:
            logger.warning(f"push send error: {e}")

    return msg


# ───────────────────────────────────────────
# 4) Okundu işaretle
# ───────────────────────────────────────────
@router.put("/conversations/{conv_id}/read")
async def mark_read(conv_id: str, data: dict = Body(default={}), user: dict = Depends(get_chat_user)):
    last_message_id = data.get("last_message_id")
    conv = await db.conversations.find_one({"id": conv_id, "participants": user["id"]}, {"_id": 0, "participants": 1})
    if not conv:
        raise HTTPException(status_code=404, detail="Konuşma bulunamadı")
    now = _now()
    await db.message_reads.update_one(
        {"conversation_id": conv_id, "user_id": user["id"]},
        {"$set": {"last_read_message_id": last_message_id, "last_read_at": now}},
        upsert=True,
    )
    # Diğer katılımcılara "okundu" sinyali
    await ws_chat.send_to_users(
        conv.get("participants", []),
        {"type": "message_read", "conversation_id": conv_id, "user_id": user["id"], "at": now},
        exclude_user=user["id"],
    )
    return {"ok": True, "at": now}


# ───────────────────────────────────────────
# 5) Yazıyor sinyali
# ───────────────────────────────────────────
@router.post("/conversations/{conv_id}/typing")
async def typing_signal(conv_id: str, data: dict = Body(default={}), user: dict = Depends(get_chat_user)):
    is_typing = bool(data.get("is_typing", True))
    conv = await db.conversations.find_one({"id": conv_id, "participants": user["id"]}, {"_id": 0, "participants": 1})
    if not conv:
        raise HTTPException(status_code=404, detail="Konuşma bulunamadı")
    payload = {
        "type": "typing_start" if is_typing else "typing_stop",
        "conversation_id": conv_id,
        "user_id": user["id"],
        "user_name": user.get("display_name") or user.get("username"),
        "at": _now(),
    }
    await ws_chat.send_to_users(conv.get("participants", []), payload, exclude_user=user["id"])
    return {"ok": True}


# ───────────────────────────────────────────
# 6) DM oluştur / aç
# ───────────────────────────────────────────
@router.post("/dm")
async def open_dm(data: dict = Body(...), user: dict = Depends(get_chat_user)):
    other_id = data.get("user_id")
    if not other_id or other_id == user["id"]:
        raise HTTPException(status_code=400, detail="Geçersiz kullanıcı")
    other = await db.users.find_one({"id": other_id, "is_active": True}, {"_id": 0})
    if not other:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")
    # Mevcut DM var mı?
    existing = await db.conversations.find_one({
        "type": "dm",
        "participants": {"$all": [user["id"], other_id], "$size": 2},
    }, {"_id": 0})
    if existing:
        return existing
    conv = Conversation(
        type="dm", name="", participants=[user["id"], other_id],
        created_by=user["id"],
    )
    await db.conversations.insert_one(conv.model_dump())
    # Karşı tarafa "yeni conversation" sinyali
    await ws_chat.send_to_user(other_id, {"type": "conversation_update", "conversation": conv.model_dump()})
    return conv.model_dump()


# ───────────────────────────────────────────
# 7) Mesajlaşılabilir kullanıcı listesi
# ───────────────────────────────────────────
@router.get("/users")
async def list_users(user: dict = Depends(get_chat_user)):
    users = await db.users.find(
        {"is_active": True, "id": {"$ne": user["id"]}},
        {"_id": 0, "id": 1, "username": 1, "display_name": 1, "role": 1, "roles": 1}
    ).sort("username", 1).to_list(500)
    online = set(ws_chat.online_user_ids())
    for u in users:
        u["is_online"] = u["id"] in online
        u["roles"] = u.get("roles") or [u.get("role")]
    return users


# ───────────────────────────────────────────
# 8) Hızlı şablonlar
# ───────────────────────────────────────────
@router.get("/templates")
async def get_templates(user: dict = Depends(get_chat_user)):
    user_roles = _user_roles(user)
    templates = [t for t in QUICK_TEMPLATES if not t.get("roles") or any(r in t["roles"] for r in user_roles) or "yonetim" in user_roles]
    return templates


# ───────────────────────────────────────────
# 9) Reaction ekle/çıkar
# ───────────────────────────────────────────
@router.post("/messages/{message_id}/reaction")
async def toggle_reaction(message_id: str, data: dict = Body(...), user: dict = Depends(get_chat_user)):
    emoji = data.get("emoji")
    if not emoji:
        raise HTTPException(status_code=400, detail="emoji gerekli")
    msg = await db.chat_messages.find_one({"id": message_id}, {"_id": 0})
    if not msg:
        raise HTTPException(status_code=404, detail="Mesaj bulunamadı")
    conv = await db.conversations.find_one({"id": msg["conversation_id"], "participants": user["id"]}, {"_id": 0, "participants": 1})
    if not conv:
        raise HTTPException(status_code=403, detail="Erişim yok")
    reactions = msg.get("reactions", {}) or {}
    users_for_emoji = set(reactions.get(emoji, []))
    if user["id"] in users_for_emoji:
        users_for_emoji.discard(user["id"])
    else:
        users_for_emoji.add(user["id"])
    if users_for_emoji:
        reactions[emoji] = list(users_for_emoji)
    else:
        reactions.pop(emoji, None)
    await db.chat_messages.update_one({"id": message_id}, {"$set": {"reactions": reactions}})
    await ws_chat.send_to_users(
        conv.get("participants", []),
        {"type": "reaction_added", "message_id": message_id, "conversation_id": msg["conversation_id"], "reactions": reactions},
    )
    return {"reactions": reactions}


# ───────────────────────────────────────────
# 10) Dosya/foto yükle
# ───────────────────────────────────────────
ROOT_DIR = Path(__file__).parent.parent
CHAT_UPLOADS = ROOT_DIR / "uploads" / "chat"
CHAT_UPLOADS.mkdir(parents=True, exist_ok=True)


@router.post("/upload")
async def chat_upload(file: UploadFile = File(...), user: dict = Depends(get_chat_user)):
    safe_name = (file.filename or "file").replace("/", "_").replace("\\", "_")
    ext = Path(safe_name).suffix.lower()
    if len(ext) > 10:
        ext = ""
    unique = f"{uuid.uuid4().hex}{ext}"
    dest = CHAT_UPLOADS / unique
    content = await file.read()
    # Boyut limiti 25 MB
    if len(content) > 25 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Dosya çok büyük (maks 25 MB)")
    dest.write_bytes(content)
    return {
        "url": f"/uploads/chat/{unique}",
        "name": safe_name,
        "size": len(content),
        "mime": file.content_type or "application/octet-stream",
    }


# ───────────────────────────────────────────
# 11) Web Push abonelik
# ───────────────────────────────────────────
@router.get("/push/vapid-public-key")
async def vapid_public_key():
    return {"key": get_vapid_public_key()}


@router.post("/push/subscribe")
async def push_subscribe(data: dict = Body(...), user: dict = Depends(get_chat_user)):
    endpoint = data.get("endpoint")
    keys = data.get("keys") or {}
    p256dh = keys.get("p256dh")
    auth = keys.get("auth")
    if not (endpoint and p256dh and auth):
        raise HTTPException(status_code=400, detail="Eksik abonelik verisi")
    user_agent = data.get("user_agent") or ""
    existing = await db.push_subscriptions.find_one({"user_id": user["id"], "endpoint": endpoint})
    if existing:
        await db.push_subscriptions.update_one(
            {"id": existing["id"]},
            {"$set": {"p256dh": p256dh, "auth": auth, "user_agent": user_agent, "last_used_at": _now()}}
        )
        return {"ok": True, "id": existing["id"]}
    sub = PushSubscription(user_id=user["id"], endpoint=endpoint, p256dh=p256dh, auth=auth, user_agent=user_agent)
    await db.push_subscriptions.insert_one(sub.model_dump())
    return {"ok": True, "id": sub.id}


@router.delete("/push/subscribe")
async def push_unsubscribe(data: dict = Body(...), user: dict = Depends(get_chat_user)):
    endpoint = data.get("endpoint")
    if not endpoint:
        raise HTTPException(status_code=400, detail="endpoint gerekli")
    result = await db.push_subscriptions.delete_many({"user_id": user["id"], "endpoint": endpoint})
    return {"deleted": result.deleted_count}


# ───────────────────────────────────────────
# 12) Toplam unread count (header badge)
# ───────────────────────────────────────────
@router.get("/unread-total")
async def unread_total(user: dict = Depends(get_chat_user)):
    user_id = user["id"]
    convs = await db.conversations.find({"participants": user_id}, {"_id": 0, "id": 1}).to_list(500)
    if not convs:
        return {"total": 0, "by_conversation": {}}
    reads = await db.message_reads.find(
        {"conversation_id": {"$in": [c["id"] for c in convs]}, "user_id": user_id},
        {"_id": 0, "conversation_id": 1, "last_read_at": 1}
    ).to_list(2000)
    read_map = {r["conversation_id"]: r["last_read_at"] for r in reads}
    total = 0
    by_conv = {}
    for c in convs:
        last_read = read_map.get(c["id"], "1970-01-01T00:00:00+00:00")
        cnt = await db.chat_messages.count_documents({
            "conversation_id": c["id"],
            "created_at": {"$gt": last_read},
            "sender_id": {"$ne": user_id},
            "deleted_at": None,
        })
        if cnt:
            by_conv[c["id"]] = cnt
            total += cnt
    return {"total": total, "by_conversation": by_conv}


# ───────────────────────────────────────────
# 13) Manuel grup oluştur (yönetim)
# ───────────────────────────────────────────
@router.post("/groups")
async def create_group(data: dict = Body(...), user: dict = Depends(get_chat_user)):
    if "yonetim" not in _user_roles(user):
        raise HTTPException(status_code=403, detail="Yalnızca Yönetim grup oluşturabilir")
    name = (data.get("name") or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Grup adı gerekli")
    participants = list(set((data.get("participants") or []) + [user["id"]]))
    conv = Conversation(
        type="group", name=name,
        description=data.get("description", ""),
        icon=data.get("icon") or "💬",
        color=data.get("color") or "#FFBF00",
        participants=participants,
        created_by=user["id"],
    )
    await db.conversations.insert_one(conv.model_dump())
    await ws_chat.send_to_users(participants, {"type": "conversation_update", "conversation": conv.model_dump()})
    return conv.model_dump()


# ───────────────────────────────────────────
# 14) Online kullanıcılar
# ───────────────────────────────────────────
@router.get("/presence/online")
async def online_users(user: dict = Depends(get_chat_user)):
    ids = ws_chat.online_user_ids()
    return {"user_ids": ids, "count": len(ids)}
