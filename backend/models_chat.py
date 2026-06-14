"""
Chat / Messenger v1 modelleri — Slack-vari iç mesajlaşma sistemi.
- 1:1 DM, rol bazlı kanal, makine kanalı tipleri.
- Otomatik bot mesajları için `msg_type=auto_event` + `event_meta` alanı.
"""
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
import uuid


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class Conversation(BaseModel):
    """Bir sohbet (DM / grup-kanal / makine-kanal)."""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    type: str = "dm"  # "dm" | "group" | "machine"
    name: str = ""
    description: str = ""
    participants: List[str] = Field(default_factory=list)  # user_id listesi
    channel_key: Optional[str] = None  # grup için: "depo", "plan", "operator", "yonetim", "genel"
    machine_id: Optional[str] = None  # makine kanalı için
    icon: Optional[str] = None  # emoji veya ikon adı
    color: Optional[str] = None  # hex renk
    last_message_at: Optional[str] = None
    last_message_preview: str = ""
    last_message_sender_id: Optional[str] = None
    last_message_sender_name: Optional[str] = None
    is_system: bool = False  # sistem oluşturduysa (silinemez)
    auto_join_roles: List[str] = Field(default_factory=list)  # bu rollere sahip yeni kullanıcı otomatik katılır
    created_at: str = Field(default_factory=_now)
    created_by: Optional[str] = None


class ChatMessage(BaseModel):
    """Tekil sohbet mesajı."""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    conversation_id: str
    sender_id: str  # "system" → otomatik bot
    sender_name: str
    sender_role: Optional[str] = None
    sender_avatar: Optional[str] = None
    text: str = ""
    msg_type: str = "text"  # "text" | "system" | "auto_event" | "file" | "image"
    attachments: List[Dict[str, Any]] = Field(default_factory=list)
    # Auto-event meta: olay tipi (bobin_request/paint_request/job_assigned/job_completed/low_stock) + detaylar
    event_type: Optional[str] = None
    event_meta: Dict[str, Any] = Field(default_factory=dict)
    reply_to: Optional[str] = None  # cevaplanan mesaj id
    reactions: Dict[str, List[str]] = Field(default_factory=dict)  # {"👍": [user_id, ...]}
    edited_at: Optional[str] = None
    deleted_at: Optional[str] = None
    created_at: str = Field(default_factory=_now)


class MessageRead(BaseModel):
    """Kullanıcı bazlı son okuma noktası."""
    model_config = ConfigDict(extra="ignore")
    conversation_id: str
    user_id: str
    last_read_message_id: Optional[str] = None
    last_read_at: str = Field(default_factory=_now)


class UserPresence(BaseModel):
    """Kullanıcı online/yazıyor durumu."""
    model_config = ConfigDict(extra="ignore")
    user_id: str
    last_seen_at: str = Field(default_factory=_now)
    is_online: bool = False
    typing_in: Optional[str] = None  # conversation_id
    typing_at: Optional[str] = None


class PushSubscription(BaseModel):
    """Tarayıcı Web Push (VAPID) aboneliği."""
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    endpoint: str
    p256dh: str  # public key
    auth: str
    user_agent: Optional[str] = None
    created_at: str = Field(default_factory=_now)
    last_used_at: Optional[str] = None


# ───────────────────────────────────────────
# Önceden tanımlı rol bazlı kanallar (seed)
# ───────────────────────────────────────────
SEED_CHANNELS = [
    {
        "key": "genel", "name": "Genel", "icon": "📢", "color": "#FFBF00",
        "description": "Tüm fabrika çalışanları — duyurular, paylaşımlar",
        "auto_join_roles": ["yonetim", "plan", "operator", "depo", "sofor"],
    },
    {
        "key": "yonetim", "name": "Yönetim", "icon": "👑", "color": "#FFD700",
        "description": "Sadece yönetim — gizli görüşmeler",
        "auto_join_roles": ["yonetim"],
    },
    {
        "key": "plan", "name": "Planlama", "icon": "📋", "color": "#60A5FA",
        "description": "Plan ekibi + Yönetim — iş atama, çizelge",
        "auto_join_roles": ["yonetim", "plan"],
    },
    {
        "key": "operator", "name": "Operatörler", "icon": "👷", "color": "#34D399",
        "description": "Operatörler + Yönetim — vardiya ve üretim",
        "auto_join_roles": ["yonetim", "operator"],
    },
    {
        "key": "depo", "name": "Depo", "icon": "📦", "color": "#A78BFA",
        "description": "Depo ekibi + Yönetim — bobin, boya, koli, sevkiyat",
        "auto_join_roles": ["yonetim", "depo"],
    },
    {
        "key": "sofor", "name": "Sürücüler", "icon": "🚚", "color": "#FB7185",
        "description": "Şoförler + Yönetim — sevkiyat koordinasyonu",
        "auto_join_roles": ["yonetim", "sofor"],
    },
]


# ───────────────────────────────────────────
# Önceden tanımlı hızlı şablonlar
# ───────────────────────────────────────────
QUICK_TEMPLATES = [
    {"key": "bobin_gonder", "text": "Bobin gönder", "emoji": "📜", "roles": ["operator", "plan"]},
    {"key": "hazirim", "text": "Hazırım", "emoji": "✅", "roles": ["operator", "depo", "plan"]},
    {"key": "bekliyorum", "text": "Bekliyorum", "emoji": "⏳", "roles": ["operator", "plan", "depo"]},
    {"key": "boya_bitti", "text": "Boya bitti", "emoji": "🎨", "roles": ["operator"]},
    {"key": "bakim_gerekiyor", "text": "Bakım gerekiyor", "emoji": "🔧", "roles": ["operator", "plan"]},
    {"key": "acil_yardim", "text": "Acil yardım", "emoji": "🆘", "roles": ["operator", "depo", "plan", "sofor"]},
]
