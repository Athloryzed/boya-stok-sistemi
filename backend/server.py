from fastapi import FastAPI, APIRouter, WebSocket, WebSocketDisconnect
from starlette.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
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

# Core modules
from database import client, db
from auth import hash_password
from websocket_manager import ws_manager, ws_manager_mgmt

# Route modules
from routes.health import router as health_router
from routes.machines import router as machines_router
from routes.jobs import router as jobs_router
from routes.shifts import router as shifts_router
from routes.defects import router as defects_router
from routes.analytics import router as analytics_router
from routes.users import router as users_router
from routes.warehouse import router as warehouse_router
from routes.paints import router as paints_router
from routes.ai import router as ai_router
from routes.dashboard import router as dashboard_router
from routes.messages import router as messages_router
from routes.visitors import router as visitors_router
from routes.operators import router as operators_router
from routes.pallets import router as pallets_router
from routes.logistics import router as logistics_router
from routes.misc import router as misc_router

app = FastAPI()

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
api_router.include_router(machines_router)
api_router.include_router(jobs_router)
api_router.include_router(shifts_router)
api_router.include_router(defects_router)
api_router.include_router(analytics_router)
api_router.include_router(users_router)
api_router.include_router(warehouse_router)
api_router.include_router(paints_router)
api_router.include_router(ai_router)
api_router.include_router(dashboard_router)
api_router.include_router(messages_router)
api_router.include_router(visitors_router)
api_router.include_router(operators_router)
api_router.include_router(pallets_router)
api_router.include_router(logistics_router)
api_router.include_router(misc_router)

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
        users = await db.users.find({"is_active": True}, {"_id": 0, "id": 1, "password": 1}).to_list(10000)
        migrated = 0
        for user in users:
            pwd = user.get("password", "")
            if pwd and not pwd.startswith("$2b$") and not pwd.startswith("$2a$"):
                hashed = hash_password(pwd)
                await db.users.update_one({"id": user["id"]}, {"$set": {"password": hashed}})
                migrated += 1
        if migrated:
            logger.info(f"Migrated {migrated} plain-text passwords to bcrypt")
    except Exception as e:
        logger.error(f"Password migration error: {e}")


from pymongo import ASCENDING, DESCENDING

@app.on_event("startup")
async def ensure_indexes():
    """Tum koleksiyonlar icin MongoDB indekslerini olustur (idempotent)"""
    try:
        # jobs - en cok sorgulanan koleksiyon
        await db.jobs.create_index("id", unique=True)
        await db.jobs.create_index([("status", ASCENDING), ("machine_id", ASCENDING)])
        await db.jobs.create_index([("status", ASCENDING), ("completed_at", DESCENDING)])
        await db.jobs.create_index("tracking_code", unique=True)
        await db.jobs.create_index([("machine_id", ASCENDING), ("status", ASCENDING)])
        await db.jobs.create_index("created_at")

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

        logger.info("MongoDB indexes ensured for all collections")
    except Exception as e:
        logger.error(f"Index creation error: {e}")

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
