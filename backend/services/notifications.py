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
                    vibrate=[200, 100, 200], require_interaction=True
                )
            )
        )
        response = fb_messaging.send_each_for_multicast(message)
        logger.info(f"FCM notification sent: {response.success_count} success, {response.failure_count} failed")
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


async def send_notification_to_managers(title: str, body: str, data: dict = None):
    """Tüm kayıtlı yöneticilere FCM bildirimi gönder"""
    try:
        tokens_cursor = db.fcm_tokens.find({"user_type": "manager"}, {"token": 1, "_id": 0})
        tokens = [doc["token"] async for doc in tokens_cursor]
        if tokens:
            await send_fcm_notification(tokens, title, body, data)
            logger.info(f"Notification sent to {len(tokens)} managers")
        else:
            logger.warning("No manager FCM tokens found")
    except Exception as e:
        logger.error(f"Error sending notification to managers: {e}")


async def send_notification_to_operators(machine_id: str, title: str, body: str, data: dict = None):
    """Belirli bir makinedeki operatörlere FCM bildirimi gönder"""
    try:
        tokens_cursor = db.fcm_tokens.find({"user_type": "operator"}, {"token": 1, "_id": 0})
        tokens = [doc["token"] async for doc in tokens_cursor]
        if tokens:
            await send_fcm_notification(tokens, title, body, data)
            logger.info(f"Notification sent to {len(tokens)} operators for machine {machine_id}")
        else:
            logger.warning("No operator FCM tokens found")
    except Exception as e:
        logger.error(f"Error sending notification to operators: {e}")


async def send_notification_to_plan_users(title: str, body: str, data: dict = None):
    """Tüm kayıtlı Plan kullanıcılarına FCM bildirimi gönder"""
    try:
        tokens_cursor = db.fcm_tokens.find({"user_type": "plan"}, {"token": 1, "_id": 0})
        tokens = [doc["token"] async for doc in tokens_cursor]
        if tokens:
            await send_fcm_notification(tokens, title, body, data)
            logger.info(f"Notification sent to {len(tokens)} plan users")
        else:
            logger.warning("No plan FCM tokens found")
    except Exception as e:
        logger.error(f"Error sending notification to plan users: {e}")


async def send_notification_to_all_workers(title: str, body: str, data: dict = None):
    """Tüm operatör ve plan kullanıcılarına FCM bildirimi gönder"""
    try:
        tokens_cursor = db.fcm_tokens.find(
            {"user_type": {"$in": ["operator", "plan"]}},
            {"token": 1, "_id": 0}
        )
        tokens = [doc["token"] async for doc in tokens_cursor]
        if tokens:
            await send_fcm_notification(tokens, title, body, data)
            logger.info(f"Notification sent to {len(tokens)} workers")
        else:
            logger.warning("No worker FCM tokens found")
    except Exception as e:
        logger.error(f"Error sending notification to all workers: {e}")
