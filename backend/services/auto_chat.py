"""
Auto-Chat servis — sistem botu, kritik üretim olaylarında otomatik mesaj atar.

Tetikleyiciler:
  - Operatör bobin istedi  → #depo + her depocu DM (acil)
  - Operatör boya istedi   → #depo
  - Düşük stok alarmı      → #depo + #yonetim
  - Plan yeni iş atadı     → makine kanalı + ilgili operatör DM
  - İş tamamlandı          → #plan + #yonetim
"""
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
import logging
import uuid

from database import db
from models_chat import ChatMessage, Conversation, SEED_CHANNELS
from websocket_chat import ws_chat
from services.web_push import send_push_to_users

logger = logging.getLogger(__name__)

SYSTEM_USER_ID = "system"
SYSTEM_USER_NAME = "Buse Bot"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


async def _get_settings(event_type: str) -> dict:
    """Bildirim ayarlarını DB'den al. Belirli bir event tipi için."""
    doc = await db.notification_settings.find_one({"id": "global"}, {"_id": 0})
    if not doc:
        return {"enabled": True}
    return (doc.get("settings") or {}).get(event_type, {"enabled": True})


async def _is_enabled(event_type: str) -> bool:
    s = await _get_settings(event_type)
    return s.get("enabled", True)


async def ensure_seed_channels():
    """Önceden tanımlı grup kanallarını idempotent şekilde oluştur ve tüm uygun kullanıcıları katıl."""
    users = await db.users.find({"is_active": True}, {"_id": 0, "id": 1, "roles": 1, "role": 1}).to_list(1000)

    for ch in SEED_CHANNELS:
        existing = await db.conversations.find_one({"channel_key": ch["key"]})
        # Bu kanala uygun kullanıcıları topla
        eligible = [u["id"] for u in users if any(r in (u.get("roles") or [u.get("role")] or []) for r in ch["auto_join_roles"])]
        if not existing:
            conv = Conversation(
                type="group",
                name=ch["name"],
                description=ch["description"],
                channel_key=ch["key"],
                icon=ch["icon"],
                color=ch["color"],
                participants=eligible,
                auto_join_roles=ch["auto_join_roles"],
                is_system=True,
                created_by=SYSTEM_USER_ID,
            )
            await db.conversations.insert_one(conv.model_dump())
            logger.info(f"Seed channel created: #{ch['key']} ({len(eligible)} members)")
        else:
            # Yeni eklenen uygun kullanıcıları katıl (auto-join)
            current = set(existing.get("participants", []))
            should = set(eligible)
            to_add = list(should - current)
            if to_add:
                await db.conversations.update_one(
                    {"id": existing["id"]},
                    {"$addToSet": {"participants": {"$each": to_add}}}
                )
                logger.info(f"Channel #{ch['key']}: auto-joined {len(to_add)} new users")


async def ensure_machine_channel(machine_id: str, machine_name: str) -> Optional[dict]:
    """Bir makine için kanal oluştur (yoksa). Operatörler + Plan + Yönetim üye."""
    existing = await db.conversations.find_one({"machine_id": machine_id, "type": "machine"})
    if existing:
        return existing
    users = await db.users.find(
        {"is_active": True, "$or": [
            {"roles": {"$in": ["yonetim", "plan", "operator"]}},
            {"role": {"$in": ["yonetim", "plan", "operator"]}},
        ]},
        {"_id": 0, "id": 1}
    ).to_list(500)
    participants = [u["id"] for u in users]
    conv = Conversation(
        type="machine",
        name=machine_name,
        description=f"{machine_name} makinesinin mesajları",
        machine_id=machine_id,
        icon="🏭",
        color="#FFBF00",
        participants=participants,
        is_system=True,
        created_by=SYSTEM_USER_ID,
    )
    await db.conversations.insert_one(conv.model_dump())
    logger.info(f"Machine channel created: {machine_name}")
    return conv.model_dump()


async def _save_and_broadcast(
    conv_id: str,
    msg: ChatMessage,
    push_title: Optional[str] = None,
    push_body: Optional[str] = None,
    push_extra: Optional[Dict[str, Any]] = None,
    push_tag: Optional[str] = None,
    event_key: Optional[str] = None,
):
    """Mesajı kaydet + WebSocket broadcast + Push gönder."""
    await db.chat_messages.insert_one(msg.model_dump())
    await db.conversations.update_one(
        {"id": conv_id},
        {"$set": {
            "last_message_at": msg.created_at,
            "last_message_preview": (msg.text or "")[:140],
            "last_message_sender_id": msg.sender_id,
            "last_message_sender_name": msg.sender_name,
        }}
    )
    conv = await db.conversations.find_one({"id": conv_id}, {"_id": 0})
    if not conv:
        return
    participants = conv.get("participants", [])
    # WebSocket broadcast
    event = {
        "type": "new_message",
        "conversation_id": conv_id,
        "conversation": {
            "id": conv["id"], "name": conv.get("name"), "type": conv.get("type"),
            "icon": conv.get("icon"), "channel_key": conv.get("channel_key"),
        },
        "message": msg.model_dump(),
    }
    await ws_chat.send_to_users(participants, event)
    # Web Push (online olmayan / sayfa kapalı kullanıcılar için)
    if push_title and push_body:
        offline_users = [u for u in participants if not ws_chat.is_online(u) and u != msg.sender_id]
        if offline_users:
            try:
                await send_push_to_users(
                    offline_users,
                    {
                        "title": push_title,
                        "body": push_body,
                        "icon": "/icon-192.png",
                        "badge": "/icon-192.png",
                        "tag": push_tag or event_key or f"conv-{conv_id}",
                        "data": {
                            "conversation_id": conv_id,
                            "message_id": msg.id,
                            "url": "/",
                            **(push_extra or {}),
                        },
                    },
                    db,
                    event_key=event_key,
                )
            except Exception as e:
                logger.warning(f"Push notification error: {e}")


def _make_system_msg(conv_id: str, text: str, event_type: str, event_meta: Optional[Dict[str, Any]] = None) -> ChatMessage:
    return ChatMessage(
        conversation_id=conv_id,
        sender_id=SYSTEM_USER_ID,
        sender_name=SYSTEM_USER_NAME,
        sender_role="system",
        sender_avatar="🤖",
        text=text,
        msg_type="auto_event",
        event_type=event_type,
        event_meta=event_meta or {},
    )


# ───────────────────────────────────────────
# TETİKLEYİCİLER
# ───────────────────────────────────────────

async def notify_bobin_request(operator_name: str, machine_name: str, machine_id: str, quantity: Optional[int] = None, extra: Optional[Dict[str, Any]] = None):
    """Operatör bobin istedi → #depo + her depocu DM."""
    if not await _is_enabled("bobin_request"):
        logger.info("bobin_request disabled by settings — skipping")
        return
    qty_text = f" {quantity} adet" if quantity else ""
    text = f"🚨 **Bobin Talebi** — {operator_name} ({machine_name}) →{qty_text} bobin istiyor."
    meta = {"machine_id": machine_id, "machine_name": machine_name, "operator_name": operator_name, "quantity": quantity, **(extra or {})}
    settings = await _get_settings("bobin_request")
    channels = settings.get("target_channels") or ["depo"]
    event_key = f"evt-bobin_request-{machine_id}-{uuid.uuid4().hex[:8]}"
    for ch_key in channels:
        ch = await db.conversations.find_one({"channel_key": ch_key}, {"_id": 0})
        if ch:
            await _save_and_broadcast(
                ch["id"],
                _make_system_msg(ch["id"], text, "bobin_request", meta),
                push_title=f"📜 Bobin talebi · {machine_name}",
                push_body=f"{operator_name}{qty_text} bobin istiyor.",
                push_extra={"event_type": "bobin_request"},
                event_key=event_key,
            )
    # Makine kanalı (varsa)
    mach_conv = await db.conversations.find_one({"machine_id": machine_id, "type": "machine"}, {"_id": 0})
    if mach_conv:
        await _save_and_broadcast(mach_conv["id"], _make_system_msg(mach_conv["id"], text, "bobin_request", meta))


async def notify_paint_request(operator_name: str, machine_name: str, machine_id: str, color: Optional[str] = None, quantity_l: Optional[float] = None):
    """Operatör boya istedi → #depo."""
    if not await _is_enabled("paint_request"):
        logger.info("paint_request disabled by settings — skipping")
        return
    parts = []
    if color: parts.append(color)
    if quantity_l: parts.append(f"{quantity_l} L")
    detail = " ".join(parts) if parts else "boya"
    text = f"🎨 **Boya Talebi** — {operator_name} ({machine_name}) → {detail} istiyor."
    meta = {"machine_id": machine_id, "machine_name": machine_name, "operator_name": operator_name, "color": color, "quantity_l": quantity_l}
    settings = await _get_settings("paint_request")
    channels = settings.get("target_channels") or ["depo"]
    event_key = f"evt-paint_request-{machine_id}-{uuid.uuid4().hex[:8]}"
    for ch_key in channels:
        ch = await db.conversations.find_one({"channel_key": ch_key}, {"_id": 0})
        if ch:
            await _save_and_broadcast(
                ch["id"], _make_system_msg(ch["id"], text, "paint_request", meta),
                push_title=f"🎨 Boya talebi · {machine_name}",
                push_body=f"{operator_name} — {detail}",
                push_extra={"event_type": "paint_request"},
                event_key=event_key,
            )


async def notify_low_stock(item_type: str, item_name: str, current: float, threshold: float, unit: str = "L"):
    """Düşük stok → ayarlanmış kanallara."""
    if not await _is_enabled("low_stock"):
        return
    settings = await _get_settings("low_stock")
    text = f"⚠️ **Düşük Stok** — {item_name} ({item_type}) yalnızca {current} {unit} kaldı (eşik: {threshold} {unit})."
    meta = {"item_type": item_type, "item_name": item_name, "current": current, "threshold": threshold, "unit": unit}
    channels = settings.get("target_channels") or ["depo", "yonetim"]
    event_key = f"evt-low_stock-{item_type}-{item_name}-{uuid.uuid4().hex[:8]}"
    for ch_key in channels:
        ch = await db.conversations.find_one({"channel_key": ch_key}, {"_id": 0})
        if ch:
            await _save_and_broadcast(
                ch["id"], _make_system_msg(ch["id"], text, "low_stock", meta),
                push_title=f"⚠️ Düşük stok: {item_name}",
                push_body=f"{current} {unit} kaldı (eşik {threshold} {unit})",
                push_extra={"event_type": "low_stock"},
                event_key=event_key,
            )


async def notify_job_assigned(job: dict):
    """Plan yeni iş atadı → makine kanalı."""
    if not await _is_enabled("job_assigned"):
        return
    machine_id = job.get("machine_id")
    machine_name = job.get("machine_name") or "Makine"
    name = job.get("name") or "İsimsiz"
    koli = job.get("koli_count") or 0
    text = f"📋 **Yeni İş Atandı** — *{name}* · {koli} koli · {machine_name}"
    meta = {"job_id": job.get("id"), "machine_id": machine_id, "machine_name": machine_name, "koli": koli, "job_name": name}
    if machine_id:
        mach_conv = await db.conversations.find_one({"machine_id": machine_id, "type": "machine"}, {"_id": 0})
        if not mach_conv:
            await ensure_machine_channel(machine_id, machine_name)
            mach_conv = await db.conversations.find_one({"machine_id": machine_id, "type": "machine"}, {"_id": 0})
        if mach_conv:
            await _save_and_broadcast(
                mach_conv["id"], _make_system_msg(mach_conv["id"], text, "job_assigned", meta),
                push_title=f"📋 Yeni iş · {machine_name}",
                push_body=f"{name} · {koli} koli",
                push_extra={"event_type": "job_assigned", "job_id": job.get("id")},
                event_key=f"evt-new_job-{job.get('id') or name}",
            )


async def notify_job_completed(job: dict):
    """İş tamamlandı → ayarlanmış kanallara."""
    if not await _is_enabled("job_completed"):
        return
    settings = await _get_settings("job_completed")
    name = job.get("name") or "İş"
    machine_name = job.get("machine_name") or "Makine"
    koli = job.get("koli_produced") or job.get("koli_count") or 0
    operator = job.get("operator_name") or "Operatör"
    text = f"✅ **İş Tamamlandı** — *{name}* · {koli} koli · {machine_name} · {operator}"
    meta = {"job_id": job.get("id"), "machine_name": machine_name, "koli_produced": koli, "operator": operator, "job_name": name, "event_key": f"evt-job_completed-{job.get('id') or name}"}
    channels = settings.get("target_channels") or ["plan", "yonetim"]
    job_id = job.get("id") or name
    event_tag = f"evt-job_completed-{job_id}"
    for ch_key in channels:
        ch = await db.conversations.find_one({"channel_key": ch_key}, {"_id": 0})
        if ch:
            await _save_and_broadcast(
                ch["id"], _make_system_msg(ch["id"], text, "job_completed", meta),
                push_title=f"✅ Tamamlandı · {machine_name}",
                push_body=f"{name} · {koli} koli — {operator}",
                push_extra={"event_type": "job_completed", "event_key": event_tag},
                push_tag=event_tag,
                event_key=event_tag,
            )


async def notify_maintenance_request(operator_name: str, machine_name: str, machine_id: str, note: Optional[str] = None):
    """Operatör bakım talep etti → #yonetim + makine kanalı."""
    text = f"🔧 **Bakım Talebi** — {operator_name} ({machine_name}) bakım istiyor."
    if note:
        text += f"\n_Not: {note}_"
    meta = {"machine_id": machine_id, "machine_name": machine_name, "operator_name": operator_name, "note": note}
    event_key = f"evt-maintenance-{machine_id}-{uuid.uuid4().hex[:8]}"
    for ch_key in ("yonetim", "plan"):
        ch = await db.conversations.find_one({"channel_key": ch_key}, {"_id": 0})
        if ch:
            await _save_and_broadcast(
                ch["id"], _make_system_msg(ch["id"], text, "maintenance_request", meta),
                push_title=f"🔧 Bakım talebi · {machine_name}",
                push_body=f"{operator_name} bakım istiyor" + (f": {note[:50]}" if note else ""),
                push_extra={"event_type": "maintenance_request"},
                event_key=event_key,
            )
    mach_conv = await db.conversations.find_one({"machine_id": machine_id, "type": "machine"}, {"_id": 0})
    if mach_conv:
        await _save_and_broadcast(mach_conv["id"], _make_system_msg(mach_conv["id"], text, "maintenance_request", meta))


async def notify_emergency(operator_name: str, machine_name: str, machine_id: str, note: Optional[str] = None):
    """Operatör acil yardım istedi → #yonetim + #plan + #operator + makine kanalı (TÜM kanallara)."""
    text = f"🆘 **ACİL YARDIM** — {operator_name} ({machine_name}) acil yardım istiyor!"
    if note:
        text += f"\n_Detay: {note}_"
    meta = {"machine_id": machine_id, "machine_name": machine_name, "operator_name": operator_name, "note": note, "priority": "emergency"}
    event_key = f"evt-emergency-{machine_id}-{uuid.uuid4().hex[:8]}"
    for ch_key in ("yonetim", "plan", "operator", "depo"):
        ch = await db.conversations.find_one({"channel_key": ch_key}, {"_id": 0})
        if ch:
            await _save_and_broadcast(
                ch["id"], _make_system_msg(ch["id"], text, "emergency", meta),
                push_title=f"🆘 ACİL · {machine_name}",
                push_body=f"{operator_name} yardım istiyor!",
                push_extra={"event_type": "emergency", "priority": "high"},
                event_key=event_key,
            )
    mach_conv = await db.conversations.find_one({"machine_id": machine_id, "type": "machine"}, {"_id": 0})
    if mach_conv:
        await _save_and_broadcast(mach_conv["id"], _make_system_msg(mach_conv["id"], text, "emergency", meta))


async def post_user_event(channel_key: str, text: str, event_type: str = "user_event", event_meta: Optional[Dict[str, Any]] = None, push_title: Optional[str] = None, push_body: Optional[str] = None):
    """Manuel sistem mesajı (genel kullanım)."""
    ch = await db.conversations.find_one({"channel_key": channel_key}, {"_id": 0})
    if not ch:
        return
    await _save_and_broadcast(
        ch["id"], _make_system_msg(ch["id"], text, event_type, event_meta),
        push_title=push_title, push_body=push_body,
    )
