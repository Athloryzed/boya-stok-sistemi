from fastapi import FastAPI, APIRouter, WebSocket, WebSocketDisconnect, Request
from starlette.middleware.cors import CORSMiddleware
from starlette.middleware.gzip import GZipMiddleware
from middleware.idempotency import IdempotencyMiddleware
from middleware.security_headers import SecurityHeadersMiddleware
from fastapi.staticfiles import StaticFiles
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from fastapi.responses import JSONResponse
from pathlib import Path
import os
import logging
import uuid

# Logging'i erken yapılandır
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

from rate_limit_utils import get_real_client_ip

# Rate limiter (CGNAT/proxy-aware: gerçek client IP'sini header'dan okur)
limiter = Limiter(key_func=get_real_client_ip)

# Core modules
from database import client, db
from auth import hash_password
from websocket_manager import ws_manager, ws_manager_mgmt
from websocket_chat import ws_chat

# Route modules
from routes.health import router as health_router
from routes.weather import router as weather_router
from routes.machines import router as machines_router
from routes.jobs import router as jobs_router
from routes.shifts import router as shifts_router
from routes.defects import router as defects_router
from routes.analytics import router as analytics_router
from routes.users import router as users_router
from routes.warehouse import router as warehouse_router
from routes.paints import router as paints_router
from routes.ai import router as ai_router
from routes.ai_panel import router as ai_panel_router
from routes.dashboard import router as dashboard_router
from routes.messages import router as messages_router
from routes.visitors import router as visitors_router
from routes.operators import router as operators_router
from routes.pallets import router as pallets_router
from routes.logistics import router as logistics_router
from routes.misc import router as misc_router
from routes.bobins import router as bobins_router
from routes.menu import router as menu_router
from routes.customers import router as customers_router
from routes.warehouse_assign import router as warehouse_assign_router
from routes.brand_stock import router as brand_stock_router
from routes.koli_stock import router as koli_stock_router
from routes.backups import router as backups_router, start_scheduler as start_backup_scheduler
from routes.auth_refresh import router as auth_refresh_router
from routes.security_admin import router as security_admin_router
from routes.chat import router as chat_router

app = FastAPI()
app.state.limiter = limiter

@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse(
        status_code=429,
        content={"detail": "Çok fazla istek. Lütfen biraz bekleyin."}
    )

# Uploads klasörü için static files
UPLOADS_DIR = Path(__file__).parent / "uploads"
UPLOADS_DIR.mkdir(exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")

# Health check endpoint for Kubernetes (on root app, not api router)
@app.get("/health")
async def health_check():
    """Health check endpoint for Kubernetes liveness/readiness probes"""
    try:
        await client.admin.command('ping')
        return {"status": "healthy", "database": "connected"}
    except Exception as e:
        logging.error(f"Health check failed: {e}")
        return {"status": "healthy", "database": "disconnected"}

# API Router - tüm route modüllerini dahil et
api_router = APIRouter(prefix="/api")
api_router.include_router(health_router)
api_router.include_router(weather_router)
api_router.include_router(machines_router)
api_router.include_router(jobs_router)
api_router.include_router(shifts_router)
api_router.include_router(defects_router)
api_router.include_router(analytics_router)
api_router.include_router(users_router)
api_router.include_router(warehouse_router)
api_router.include_router(paints_router)
api_router.include_router(ai_router)
api_router.include_router(ai_panel_router)
api_router.include_router(dashboard_router)
api_router.include_router(messages_router)
api_router.include_router(visitors_router)
api_router.include_router(operators_router)
api_router.include_router(pallets_router)
api_router.include_router(logistics_router)
api_router.include_router(misc_router)
api_router.include_router(bobins_router)
api_router.include_router(menu_router)
api_router.include_router(customers_router)
api_router.include_router(warehouse_assign_router)
api_router.include_router(brand_stock_router)
api_router.include_router(koli_stock_router)
api_router.include_router(backups_router)
api_router.include_router(auth_refresh_router)
api_router.include_router(security_admin_router)
api_router.include_router(chat_router)


@app.on_event("startup")
async def _on_startup():
    try:
        start_backup_scheduler()
    except Exception as e:
        logging.warning(f"Backup scheduler başlatılamadı: {e}")

app.include_router(api_router)

# ==================== WebSocket Endpoints ====================

@app.websocket("/api/ws/manager/{manager_id}")
async def manager_websocket(websocket: WebSocket, manager_id: str):
    await ws_manager_mgmt.connect(websocket, manager_id)
    logging.info(f"Manager WebSocket connected: {manager_id}")
    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        ws_manager_mgmt.disconnect(manager_id)
        logging.info(f"Manager WebSocket disconnected: {manager_id}")
    except Exception as e:
        logging.error(f"Manager WebSocket error: {e}")
        ws_manager_mgmt.disconnect(manager_id)


@app.websocket("/api/ws/warehouse")
async def warehouse_websocket(websocket: WebSocket):
    await ws_manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
    except Exception as e:
        logging.error(f"WebSocket error: {e}")
        ws_manager.disconnect(websocket)


@app.websocket("/api/ws/operator/{machine_id}")
async def operator_websocket(websocket: WebSocket, machine_id: str):
    await ws_manager.connect(websocket)
    logging.info(f"Operator WebSocket connected for machine: {machine_id}")
    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
        logging.info(f"Operator WebSocket disconnected for machine: {machine_id}")
    except Exception as e:
        logging.error(f"Operator WebSocket error: {e}")
        ws_manager.disconnect(websocket)


@app.websocket("/api/ws/chat")
async def chat_websocket(websocket: WebSocket, token: str = None):
    """Chat WebSocket — user_id query param ile bağlanır (JWT token verified)."""
    from auth import decode_token
    user_id = None
    try:
        token = websocket.query_params.get("token")
        if not token:
            await websocket.close(code=4401)
            return
        try:
            payload = decode_token(token)
            user_id = payload.get("sub") or payload.get("user_id") or payload.get("id")
        except Exception:
            await websocket.close(code=4401)
            return
        if not user_id:
            await websocket.close(code=4401)
            return
        await ws_chat.connect(websocket, user_id)
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        await ws_chat.disconnect(websocket)
    except Exception as e:
        logging.error(f"Chat WS error user={user_id}: {e}")
        await ws_chat.disconnect(websocket)

# ==================== Startup Events ====================

@app.on_event("startup")
async def backfill_tracking_codes():
    try:
        jobs_to_update = await db.jobs.find(
            {"$or": [
                {"tracking_code": {"$exists": False}},
                {"tracking_code": {"$regex": "^.{1,8}$"}}
            ]}, {"_id": 0, "id": 1}
        ).to_list(10000)
        for job in jobs_to_update:
            code = str(uuid.uuid4())
            await db.jobs.update_one({"id": job["id"]}, {"$set": {"tracking_code": code}})
        if jobs_to_update:
            logger.info(f"Backfilled/upgraded tracking codes for {len(jobs_to_update)} jobs")
    except Exception as e:
        logger.error(f"Tracking code backfill error: {e}")


@app.on_event("startup")
async def migrate_passwords_to_bcrypt():
    try:
        # Users tablosu
        users = await db.users.find({"is_active": True}, {"_id": 0, "id": 1, "password": 1, "role": 1, "roles": 1}).to_list(10000)
        migrated = 0
        roles_migrated = 0
        for user in users:
            updates = {}
            pwd = user.get("password", "")
            if pwd and not pwd.startswith("$2b$") and not pwd.startswith("$2a$"):
                updates["password"] = hash_password(pwd)
                migrated += 1
            # roles array yoksa role'den türet
            if not user.get("roles") and user.get("role"):
                updates["roles"] = [user["role"]]
                roles_migrated += 1
            if updates:
                await db.users.update_one({"id": user["id"]}, {"$set": updates})
        if migrated:
            logger.info(f"Migrated {migrated} plain-text user passwords to bcrypt")
        if roles_migrated:
            logger.info(f"Migrated {roles_migrated} users to roles[] array")

        # Drivers tablosu
        drivers = await db.drivers.find({"is_active": True}, {"_id": 0, "id": 1, "password": 1}).to_list(10000)
        driver_migrated = 0
        for driver in drivers:
            pwd = driver.get("password", "")
            if pwd and not pwd.startswith("$2b$") and not pwd.startswith("$2a$"):
                hashed = hash_password(pwd)
                await db.drivers.update_one({"id": driver["id"]}, {"$set": {"password": hashed}})
                driver_migrated += 1
        if driver_migrated:
            logger.info(f"Migrated {driver_migrated} plain-text driver passwords to bcrypt")
    except Exception as e:
        logger.error(f"Password migration error: {e}")


from pymongo import ASCENDING, DESCENDING

@app.on_event("startup")
async def ensure_indexes():
    """Tum koleksiyonlar icin MongoDB indekslerini olustur (idempotent)"""
    try:
        # jobs - en cok sorgulanan koleksiyon
        await db.jobs.create_index("id", unique=True)
        await db.ai_panel_messages.create_index([("user_id", ASCENDING), ("panel", ASCENDING), ("created_at", ASCENDING)])
        await db.jobs.create_index([("status", ASCENDING), ("machine_id", ASCENDING)])
        await db.jobs.create_index([("status", ASCENDING), ("completed_at", DESCENDING)])
        await db.jobs.create_index("tracking_code", unique=True)
        await db.jobs.create_index([("machine_id", ASCENDING), ("status", ASCENDING)])
        await db.jobs.create_index("created_at")
        # Customer sipariş geçmişi için index
        await db.jobs.create_index([("customer_id", ASCENDING), ("created_at", DESCENDING)])

        # customers
        await db.customers.create_index("id", unique=True)
        await db.customers.create_index("name")
        await db.customers.create_index("phone")
        await db.customers.create_index([("code", ASCENDING)])
        await db.customers.create_index([("archived", ASCENDING), ("name", ASCENDING)])

        # warehouse_transfers (depo transfer log)
        await db.warehouse_transfers.create_index([("at", DESCENDING)])
        await db.warehouse_transfers.create_index([("item_type", ASCENDING), ("item_id", ASCENDING)])
        await db.bobins.create_index("warehouse")
        await db.marka_stok.create_index("warehouse")

        # users
        await db.users.create_index("id", unique=True)
        await db.users.create_index([("username", ASCENDING), ("is_active", ASCENDING)])
        await db.users.create_index([("role", ASCENDING), ("is_active", ASCENDING)])

        # machines
        await db.machines.create_index("id", unique=True)
        await db.machines.create_index("name", unique=True)

        # audit_logs
        await db.audit_logs.create_index([("created_at", DESCENDING)])

        # shifts
        await db.shifts.create_index("id", unique=True)
        await db.shifts.create_index("status")

        # defect_logs
        await db.defect_logs.create_index("date")
        await db.defect_logs.create_index([("machine_id", ASCENDING), ("created_at", DESCENDING)])

        # paint_movements
        await db.paint_movements.create_index([("movement_type", ASCENDING), ("created_at", DESCENDING)])
        await db.paint_movements.create_index([("paint_id", ASCENDING), ("created_at", DESCENDING)])

        # shift_end_reports
        await db.shift_end_reports.create_index([("created_at", DESCENDING)])
        await db.shift_end_reports.create_index("shift_id")
        await db.shift_end_reports.create_index([("machine_id", ASCENDING), ("created_at", DESCENDING)])

        # shift_operator_reports
        await db.shift_operator_reports.create_index("id", unique=True)
        await db.shift_operator_reports.create_index([("status", ASCENDING), ("shift_id", ASCENDING)])

        # machine_messages
        await db.machine_messages.create_index([("machine_id", ASCENDING), ("created_at", DESCENDING)])
        await db.machine_messages.create_index([("machine_id", ASCENDING), ("is_read", ASCENDING)])
        await db.machine_messages.create_index([("sender_role", ASCENDING), ("created_at", DESCENDING)])

        # visitors
        await db.visitors.create_index([("visited_at", DESCENDING)])

        # operator_sessions
        await db.operator_sessions.create_index([("device_id", ASCENDING), ("expires_at", DESCENDING)])

        # pallets
        await db.pallets.create_index("id", unique=True)
        await db.pallets.create_index("job_id")
        await db.pallets.create_index("status")

        # paints
        await db.paints.create_index("id", unique=True)

        # active_paints_to_machine
        await db.active_paints_to_machine.create_index("id", unique=True)
        await db.active_paints_to_machine.create_index([("returned", ASCENDING), ("created_at", DESCENDING)])

        # ai_chat_history
        await db.ai_chat_history.create_index([("session_id", ASCENDING), ("created_at", ASCENDING)])

        # fcm_tokens
        await db.fcm_tokens.create_index("token", unique=True)
        await db.fcm_tokens.create_index("user_type")

        # shipments
        await db.shipments.create_index("id", unique=True)
        await db.shipments.create_index([("status", ASCENDING), ("driver_id", ASCENDING)])

        # drivers
        await db.drivers.create_index([("name", ASCENDING), ("is_active", ASCENDING)])

        # vehicles
        await db.vehicles.create_index("id", unique=True)

        # warehouse_requests
        await db.warehouse_requests.create_index([("status", ASCENDING), ("created_at", DESCENDING)])

        # maintenance_logs
        await db.maintenance_logs.create_index([("machine_id", ASCENDING), ("ended_at", ASCENDING)])

        # bobins
        await db.bobins.create_index("id", unique=True)
        await db.bobins.create_index("barcode", sparse=True)
        await db.bobins.create_index([("brand", ASCENDING), ("width_cm", ASCENDING), ("grammage", ASCENDING), ("color", ASCENDING)])

        # bobin_movements
        await db.bobin_movements.create_index([("bobin_id", ASCENDING), ("created_at", DESCENDING)])
        await db.bobin_movements.create_index([("movement_type", ASCENDING), ("created_at", DESCENDING)])
        await db.bobin_movements.create_index([("created_at", DESCENDING)])

        # idempotency_keys — TTL index: 1 saat sonra otomatik silinir
        # Bu, ağ retry'ları ve hızlı çift-tıklama için yeterli pencere
        await db.idempotency_keys.create_index("created_at", expireAfterSeconds=3600)

        # ─── Güvenlik Sertleştirme İndeksleri ───
        # login_attempts: 24 saat sonra otomatik temizlensin (raporlama dışı)
        await db.login_attempts.create_index("created_at", expireAfterSeconds=86400)
        await db.login_attempts.create_index([("account", ASCENDING), ("created_at", DESCENDING)])

        # account_lockouts: süresi dolan kilitler request anında temizlenir (TTL gerekmez)
        await db.account_lockouts.create_index("locked_until")

        # audit_logs: hash chain için created_at sıralı, ayrıca prev_hash arama için
        await db.audit_logs.create_index([("created_at", ASCENDING)])

        # audit_alarms: tarih ve onay durumu
        await db.audit_alarms.create_index([("created_at", DESCENDING)])
        await db.audit_alarms.create_index([("acknowledged", ASCENDING), ("severity", ASCENDING)])

        # revoked_tokens: refresh token blacklist — expires_at ile TTL
        await db.revoked_tokens.create_index("expires_at", expireAfterSeconds=0)

        # ─── Chat / Messenger v1 İndeksleri ───
        await db.conversations.create_index("id", unique=True)
        await db.conversations.create_index([("participants", ASCENDING), ("last_message_at", DESCENDING)])
        await db.conversations.create_index("channel_key", sparse=True)
        await db.conversations.create_index([("type", ASCENDING), ("machine_id", ASCENDING)], sparse=True)
        await db.chat_messages.create_index("id", unique=True)
        await db.chat_messages.create_index([("conversation_id", ASCENDING), ("created_at", DESCENDING)])
        await db.chat_messages.create_index([("conversation_id", ASCENDING), ("deleted_at", ASCENDING), ("created_at", DESCENDING)])
        await db.message_reads.create_index([("conversation_id", ASCENDING), ("user_id", ASCENDING)], unique=True)
        await db.push_subscriptions.create_index("id", unique=True)
        await db.push_subscriptions.create_index([("user_id", ASCENDING), ("endpoint", ASCENDING)], unique=True)

        logger.info("MongoDB indexes ensured for all collections")
    except Exception as e:
        logger.error(f"Index creation error: {e}")


@app.on_event("startup")
async def seed_chat_channels():
    """Önceden tanımlı rol bazlı kanalları oluştur ve uygun kullanıcıları otomatik katıl."""
    try:
        from services.auto_chat import ensure_seed_channels
        await ensure_seed_channels()
        # Mevcut makineler için makine kanalları
        from services.auto_chat import ensure_machine_channel
        machines = await db.machines.find({}, {"_id": 0, "id": 1, "name": 1}).to_list(500)
        for m in machines:
            await ensure_machine_channel(m["id"], m.get("name") or "Makine")
        logger.info(f"Chat seed: {len(machines)} machine channels ensured")
    except Exception as e:
        logger.error(f"Chat seed error: {e}")


@app.on_event("startup")
async def migrate_pii_encryption():
    """Mevcut düz-metin phone alanlarını PII şifrelemesine taşır (idempotent).

    Hassas alanlar: users.phone, drivers.phone
    enc:v1: prefix'i olanlar atlanır.
    """
    try:
        from services.crypto_utils import encrypt_pii, ENC_PREFIX

        # Users
        users = await db.users.find(
            {"phone": {"$exists": True, "$nin": [None, ""]}},
            {"_id": 0, "id": 1, "phone": 1}
        ).to_list(20000)
        u_migrated = 0
        for u in users:
            ph = u.get("phone", "")
            if ph and not ph.startswith(ENC_PREFIX):
                await db.users.update_one({"id": u["id"]}, {"$set": {"phone": encrypt_pii(ph)}})
                u_migrated += 1
        if u_migrated:
            logger.info(f"PII migration: {u_migrated} users.phone encrypted")

        # Drivers
        drivers = await db.drivers.find(
            {"phone": {"$exists": True, "$nin": [None, ""]}},
            {"_id": 0, "id": 1, "phone": 1}
        ).to_list(20000)
        d_migrated = 0
        for d in drivers:
            ph = d.get("phone", "")
            if ph and not ph.startswith(ENC_PREFIX):
                await db.drivers.update_one({"id": d["id"]}, {"$set": {"phone": encrypt_pii(ph)}})
                d_migrated += 1
        if d_migrated:
            logger.info(f"PII migration: {d_migrated} drivers.phone encrypted")
    except Exception as e:
        logger.error(f"PII migration error: {e}")


@app.on_event("startup")
async def backfill_job_thumbnails():
    """image_url'u olup thumb_url'i olmayan işler için bir defalık thumb üret.
    Bu sayede tüm aktif iş kartlarında küçük önizleme görünür."""
    try:
        from services.image_utils import create_thumb_data_url
        cursor = db.jobs.find(
            {"image_url": {"$exists": True, "$nin": [None, ""]},
             "$or": [{"thumb_url": {"$exists": False}}, {"thumb_url": None}, {"thumb_url": ""}]},
            {"_id": 0, "id": 1, "image_url": 1},
        )
        count = 0
        async for j in cursor:
            thumb = create_thumb_data_url(j.get("image_url"))
            if thumb:
                await db.jobs.update_one({"id": j["id"]}, {"$set": {"thumb_url": thumb}})
                count += 1
        if count:
            logger.info(f"Thumbnail backfill: {count} jobs updated")
    except Exception as e:
        logger.error(f"Thumb backfill error: {e}")

# ==================== Compression Middleware (Mobil Veri Optimizasyonu) ====================
# JSON yanıtları gzip ile sıkıştırır (>500B). Mobil bağlantılarda yanıt boyutunu %70-85 düşürür.
# Bu sadece taşıma katmanını değiştirir — saklanan veride sıfır değişiklik.
app.add_middleware(GZipMiddleware, minimum_size=500, compresslevel=6)

# ==================== Idempotency Middleware (Çift-Submit Koruması) ====================
app.add_middleware(IdempotencyMiddleware)

# ==================== Security Headers Middleware (HSTS, CSP, XFO, ...) ====================
# Tüm yanıtlara güvenlik header'ları ekler — XSS, clickjacking, MIME-sniffing korumaları.
app.add_middleware(SecurityHeadersMiddleware)

# ==================== CORS Middleware ====================

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
