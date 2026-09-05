"""
Chat WebSocket Manager — Kullanıcı bazlı routing (çoklu cihaz desteği).
Mevcut `ws_manager` (broadcast) ile birlikte yaşar; chat olayları için ayrı.

Event tipleri:
  - "new_message"        : Yeni mesaj geldi
  - "message_read"       : Karşı taraf okudu
  - "typing_start"       : Karşı taraf yazıyor
  - "typing_stop"        : Yazma durdu
  - "presence_update"    : Kullanıcı online/offline
  - "conversation_update": Conversation güncellendi (yeni katılımcı, isim değişikliği)
  - "reaction_added"     : Reaksiyon eklendi
"""
from fastapi import WebSocket
from typing import Dict, Set, List, Optional
from datetime import datetime, timezone
import logging
import asyncio

logger = logging.getLogger(__name__)


class ChatConnectionManager:
    def __init__(self):
        # user_id → set of WebSocket connections (çoklu cihaz)
        self.user_sockets: Dict[str, Set[WebSocket]] = {}
        # WebSocket → user_id (ters arama)
        self.socket_user: Dict[WebSocket, str] = {}
        self._lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket, user_id: str):
        # accept() çağrısı server.py'deki chat_websocket'te, token doğrulamasından
        # ÖNCE yapılıyor (geçersiz token'da düzgün close code'u dönebilmek için).
        async with self._lock:
            if user_id not in self.user_sockets:
                self.user_sockets[user_id] = set()
            self.user_sockets[user_id].add(websocket)
            self.socket_user[websocket] = user_id
        logger.info(f"Chat WS connect: user={user_id}, total_users={len(self.user_sockets)}")
        # Online durumu broadcast
        await self.broadcast({
            "type": "presence_update",
            "user_id": user_id,
            "is_online": True,
            "at": datetime.now(timezone.utc).isoformat(),
        }, exclude_user=user_id)

    async def disconnect(self, websocket: WebSocket):
        user_id = None
        was_last = False
        async with self._lock:
            user_id = self.socket_user.pop(websocket, None)
            if user_id and user_id in self.user_sockets:
                self.user_sockets[user_id].discard(websocket)
                if not self.user_sockets[user_id]:
                    del self.user_sockets[user_id]
                    was_last = True
        if user_id:
            logger.info(f"Chat WS disconnect: user={user_id}, was_last={was_last}")
            if was_last:
                await self.broadcast({
                    "type": "presence_update",
                    "user_id": user_id,
                    "is_online": False,
                    "at": datetime.now(timezone.utc).isoformat(),
                }, exclude_user=user_id)

    async def send_to_user(self, user_id: str, message: dict):
        """Belirli bir kullanıcının tüm cihazlarına gönder."""
        sockets = list(self.user_sockets.get(user_id, set()))
        for ws in sockets:
            try:
                await ws.send_json(message)
            except Exception as e:
                logger.warning(f"send_to_user failed user={user_id}: {e}")
                await self.disconnect(ws)

    async def send_to_users(self, user_ids: List[str], message: dict, exclude_user: Optional[str] = None):
        """Birden fazla kullanıcıya gönder (paralel)."""
        tasks = []
        for uid in set(user_ids):
            if exclude_user and uid == exclude_user:
                continue
            if uid in self.user_sockets:
                tasks.append(self.send_to_user(uid, message))
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)

    async def broadcast(self, message: dict, exclude_user: Optional[str] = None):
        """Tüm bağlı kullanıcılara gönder."""
        await self.send_to_users(list(self.user_sockets.keys()), message, exclude_user=exclude_user)

    def is_online(self, user_id: str) -> bool:
        return user_id in self.user_sockets and bool(self.user_sockets[user_id])

    def online_user_ids(self) -> List[str]:
        return list(self.user_sockets.keys())


# Singleton
ws_chat = ChatConnectionManager()
