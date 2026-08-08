import os
import logging
import asyncio
from typing import List
from pathlib import Path

logger = logging.getLogger(__name__)

# Firebase Admin SDK Setup
firebase_app = None
try:
    import firebase_admin
    from firebase_admin import credentials, messaging

    ROOT_DIR = Path(__file__).parent.parent

    if not firebase_admin._apps:
        try:
            cred = credentials.Certificate(ROOT_DIR / 'firebase-service-account.json')
            firebase_app = firebase_admin.initialize_app(cred)
            logger.info("Firebase Admin SDK initialized with service account!")
        except Exception:
            firebase_app = firebase_admin.initialize_app(options={'projectId': 'buse-kagit'})
            logger.info("Firebase Admin SDK initialized with project ID only")
except Exception as e:
    logger.warning(f"Firebase Admin SDK initialization failed: {e}")

# Twilio WhatsApp Setup
twilio_client = None
try:
    from twilio.rest import Client as TwilioClient
    twilio_sid = os.environ.get('TWILIO_ACCOUNT_SID')
    twilio_token = os.environ.get('TWILIO_AUTH_TOKEN')
    logger.info(f"Twilio SID: {twilio_sid[:10] if twilio_sid else 'NOT SET'}...")
    logger.info(f"Twilio Token: {twilio_token[:10] if twilio_token else 'NOT SET'}...")
    if twilio_sid and twilio_token:
        twilio_client = TwilioClient(twilio_sid, twilio_token)
        logger.info("Twilio client initialized successfully!")
    else:
        logger.warning("Twilio credentials missing - WhatsApp disabled")
except Exception as e:
    logger.warning(f"Twilio initialization failed: {e}")


async def send_fcm_notification(tokens: List[str], title: str, body: str, data: dict = None):
    """Firebase Cloud Messaging ile bildirim gönder"""
    if not tokens:
        logger.warning("No FCM tokens to send notification")
        return False

    try:
        from firebase_admin import messaging as fb_messaging
        message = fb_messaging.MulticastMessage(
            notification=fb_messaging.Notification(title=title, body=body),
            data=data or {},
            tokens=tokens,
            android=fb_messaging.AndroidConfig(
                priority='high',
                notification=fb_messaging.AndroidNotification(
                    sound='default', priority='high', channel_id='job_notifications'
                )
            ),
            webpush=fb_messaging.WebpushConfig(
                notification=fb_messaging.WebpushNotification(
                    icon='/logo192.png', badge='/logo192.png',
                    vibrate=[200, 100, 200], require_interaction=True,
                    tag=(data or {}).get('tag') or None,
                )
            )
        )
        response = fb_messaging.send_each_for_multicast(message)
        logger.info(f"FCM notification sent: {response.success_count} success, {response.failure_count} failed")
        # Geçersiz/bayat token'ları temizle (bayat token birikimi aynı cihaza çift bildirim yollar)
        dead = []
        for idx, resp in enumerate(response.responses):
            if not resp.success:
                exc = resp.exception
                cls = exc.__class__.__name__ if exc else ""
                err = str(exc or "").lower()
                if cls in ("UnregisteredError", "InvalidArgumentError", "SenderIdMismatchError") \
                        or "unregistered" in err or "not found" in err or "invalid" in err or "not a valid" in err:
                    dead.append(tokens[idx])
        if dead:
            await db.fcm_tokens.delete_many({"token": {"$in": dead}})
            logger.info(f"Cleaned {len(dead)} stale FCM tokens")
        return True
    except Exception as e:
        logger.error(f"FCM notification error: {e}")
        return False


async def send_whatsapp_notification(message: str):
    """WhatsApp bildirimi gönder"""
    if not twilio_client:
        logger.warning("Twilio client not available")
        return False

    try:
        whatsapp_from = os.environ.get('TWILIO_WHATSAPP_FROM', 'whatsapp:+14155238886')
        whatsapp_to = os.environ.get('WHATSAPP_NOTIFY_NUMBER')

        if not whatsapp_to:
            logger.warning("WHATSAPP_NOTIFY_NUMBER not set")
            return False

        if not whatsapp_to.startswith('whatsapp:'):
            whatsapp_to = f"whatsapp:{whatsapp_to}"

        logger.info(f"Sending WhatsApp to {whatsapp_to}")

        loop = asyncio.get_event_loop()
        msg = await loop.run_in_executor(
            None,
            lambda: twilio_client.messages.create(
                body=message, from_=whatsapp_from, to=whatsapp_to
            )
        )
        logger.info(f"WhatsApp message sent: {msg.sid}")
        return True
    except Exception as e:
        logger.error(f"WhatsApp send failed: {e}")
        return False


from database import db


async def send_notification_to_user_types(user_types: List[str], title: str, body: str, data: dict = None, event_key: str = None):
    """Birden fazla user_type'a TEK seferde bildirim gönder.

    - Token'lar tekilleştirilir (aynı cihaza 1 gönderim)
    - event_key verilirse: kullanıcı başına bildirim bekçisi (guard) uygulanır —
      aynı olay aynı kullanıcıya başka bir kanaldan da gitmişse ATLANIR.
      Kullanıcının tüm cihazlarına (token'larına) yine tek seferde gider.
    """
    try:
        tokens_cursor = db.fcm_tokens.find(
            {"$or": [{"user_type": {"$in": user_types}}, {"user_types": {"$in": user_types}}]},
            {"token": 1, "user_id": 1, "_id": 0}
        )
        seen = set()
        owner_tokens = {}  # kullanıcı (veya token) -> [token, ...]
        async for doc in tokens_cursor:
            t = doc.get("token")
            if not t or t in seen:
                continue
            seen.add(t)
            owner = doc.get("user_id") or f"tok:{t[:48]}"
            owner_tokens.setdefault(owner, []).append(t)

        if not owner_tokens:
            logger.warning(f"No FCM tokens found for {user_types}")
            return

        owners = list(owner_tokens.keys())
        if event_key:
            from services.notification_guard import claim_users
            owners = await claim_users(event_key, owners)
            if not owners:
                logger.info(f"FCM skipped (guard): all users already notified for {event_key}")
                return

        tokens = [t for o in owners for t in owner_tokens[o]]
        payload = dict(data or {})
        if event_key and not payload.get("tag"):
            payload["tag"] = event_key
        await send_fcm_notification(tokens, title, body, payload)
        logger.info(f"Notification sent to {len(tokens)} devices / {len(owners)} users ({', '.join(user_types)})")
    except Exception as e:
        logger.error(f"Error sending notification to {user_types}: {e}")


async def send_notification_to_managers(title: str, body: str, data: dict = None, event_key: str = None):
    """Tüm kayıtlı yöneticilere FCM bildirimi gönder"""
    await send_notification_to_user_types(["manager"], title, body, data, event_key)


async def send_notification_to_operators(machine_id: str, title: str, body: str, data: dict = None, event_key: str = None):
    """Operatörlere FCM bildirimi gönder"""
    await send_notification_to_user_types(["operator"], title, body, data, event_key)


async def send_notification_to_plan_users(title: str, body: str, data: dict = None, event_key: str = None):
    """Tüm kayıtlı Plan kullanıcılarına FCM bildirimi gönder"""
    await send_notification_to_user_types(["plan"], title, body, data, event_key)


async def send_notification_to_all_workers(title: str, body: str, data: dict = None, event_key: str = None):
    """Tüm operatör ve plan kullanıcılarına FCM bildirimi gönder"""
    await send_notification_to_user_types(["operator", "plan"], title, body, data, event_key)
