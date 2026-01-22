from fastapi import FastAPI, APIRouter, HTTPException, Body
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment
from io import BytesIO
from fastapi.responses import StreamingResponse

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

class Machine(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    status: str = "idle"
    current_job_id: Optional[str] = None
    maintenance: bool = False
    maintenance_reason: Optional[str] = None
    maintenance_started: Optional[str] = None

class Job(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    koli_count: int
    colors: str
    machine_id: str
    machine_name: str
    notes: Optional[str] = None
    delivery_date: Optional[str] = None
    status: str = "pending"
    operator_name: Optional[str] = None
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    completed_koli: int = 0
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class Shift(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    started_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    ended_at: Optional[str] = None
    status: str = "active"

class MaintenanceLog(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    machine_id: str
    machine_name: str
    reason: str
    started_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    ended_at: Optional[str] = None

class WarehouseRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    operator_name: str
    machine_name: str
    item_type: str
    quantity: int
    status: str = "pending"
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class PalletScan(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    pallet_code: str
    job_id: str
    job_name: str
    operator_name: str
    scanned_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

@api_router.get("/")
async def root():
    return {"message": "Buse Kağıt API"}

@api_router.post("/machines/init")
async def init_machines():
    machine_names = ["40x40", "40x40 ICM", "33x33 (Büyük)", "33x33 ICM", "33x33 (Eski)", "30x30", "24x24", "Dispanser"]
    existing = await db.machines.count_documents({})
    if existing == 0:
        machines = [Machine(name=name).model_dump() for name in machine_names]
        await db.machines.insert_many(machines)
    return {"message": "Machines initialized"}

@api_router.get("/machines", response_model=List[Machine])
async def get_machines():
    machines = await db.machines.find({}, {"_id": 0}).to_list(100)
    return machines

@api_router.put("/machines/{machine_id}/maintenance")
async def toggle_maintenance(machine_id: str, data: dict = Body(...)):
    maintenance = data.get("maintenance", False)
    reason = data.get("reason", "")
    
    machine = await db.machines.find_one({"id": machine_id}, {"_id": 0})
    if not machine:
        raise HTTPException(status_code=404, detail="Machine not found")
    
    update_data = {"maintenance": maintenance}
    
    if maintenance:
        update_data["maintenance_reason"] = reason
        update_data["maintenance_started"] = datetime.now(timezone.utc).isoformat()
        log = MaintenanceLog(
            machine_id=machine_id,
            machine_name=machine["name"],
            reason=reason
        )
        await db.maintenance_logs.insert_one(log.model_dump())
    else:
        update_data["maintenance_reason"] = None
        update_data["maintenance_started"] = None
        await db.maintenance_logs.update_one(
            {"machine_id": machine_id, "ended_at": None},
            {"$set": {"ended_at": datetime.now(timezone.utc).isoformat()}}
        )
    
    await db.machines.update_one({"id": machine_id}, {"$set": update_data})
    return {"message": "Maintenance status updated"}

@api_router.get("/maintenance-logs", response_model=List[MaintenanceLog])
async def get_maintenance_logs():
    logs = await db.maintenance_logs.find({}, {"_id": 0}).sort("started_at", -1).to_list(100)
    return logs

@api_router.post("/jobs", response_model=Job)
async def create_job(job: Job):
    doc = job.model_dump()
    await db.jobs.insert_one(doc)
    return job

@api_router.get("/jobs", response_model=List[Job])
async def get_jobs(status: Optional[str] = None, machine_id: Optional[str] = None):
    query = {}
    if status:
        query["status"] = status
    if machine_id:
        query["machine_id"] = machine_id
    jobs = await db.jobs.find(query, {"_id": 0}).sort("created_at", 1).to_list(1000)
    return jobs

@api_router.put("/jobs/{job_id}/start")
async def start_job(job_id: str, data: dict = Body(...)):
    operator_name = data.get("operator_name")
    job = await db.jobs.find_one({"id": job_id}, {"_id": 0})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    await db.jobs.update_one(
        {"id": job_id},
        {"$set": {
            "status": "in_progress",
            "operator_name": operator_name,
            "started_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    await db.machines.update_one(
        {"id": job["machine_id"]},
        {"$set": {"status": "working", "current_job_id": job_id}}
    )
    
    return {"message": "Job started"}

@api_router.put("/jobs/{job_id}/complete")
async def complete_job(job_id: str):
    job = await db.jobs.find_one({"id": job_id}, {"_id": 0})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    await db.jobs.update_one(
        {"id": job_id},
        {"$set": {
            "status": "completed",
            "completed_at": datetime.now(timezone.utc).isoformat(),
            "completed_koli": job["koli_count"]
        }}
    )
    
    await db.machines.update_one(
        {"id": job["machine_id"]},
        {"$set": {"status": "idle", "current_job_id": None}}
    )
    
    return {"message": "Job completed"}

@api_router.post("/shifts/start")
async def start_shift():
    active_shift = await db.shifts.find_one({"status": "active"}, {"_id": 0})
    if active_shift:
        raise HTTPException(status_code=400, detail="There is already an active shift")
    
    shift = Shift()
    await db.shifts.insert_one(shift.model_dump())
    return shift

@api_router.post("/shifts/end")
async def end_shift():
    active_shift = await db.shifts.find_one({"status": "active"}, {"_id": 0})
    if not active_shift:
        raise HTTPException(status_code=400, detail="No active shift found")
    
    await db.shifts.update_one(
        {"id": active_shift["id"]},
        {"$set": {
            "status": "ended",
            "ended_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    return {"message": "Shift ended"}

@api_router.get("/shifts/current")
async def get_current_shift():
    shift = await db.shifts.find_one({"status": "active"}, {"_id": 0})
    return shift

@api_router.get("/analytics/weekly")
async def get_weekly_analytics():
    from datetime import timedelta
    week_ago = datetime.now(timezone.utc) - timedelta(days=7)
    week_ago_str = week_ago.isoformat()
    
    jobs = await db.jobs.find(
        {"status": "completed", "completed_at": {"$gte": week_ago_str}},
        {"_id": 0}
    ).to_list(1000)
    
    machine_stats = {}
    operator_stats = {}
    
    for job in jobs:
        machine = job["machine_name"]
        operator = job.get("operator_name", "Unknown")
        koli = job["completed_koli"]
        
        if machine not in machine_stats:
            machine_stats[machine] = 0
        machine_stats[machine] += koli
        
        if operator not in operator_stats:
            operator_stats[operator] = 0
        operator_stats[operator] += koli
    
    return {
        "machine_stats": machine_stats,
        "operator_stats": operator_stats
    }

@api_router.get("/analytics/monthly")
async def get_monthly_analytics():
    from datetime import timedelta
    month_ago = datetime.now(timezone.utc) - timedelta(days=30)
    month_ago_str = month_ago.isoformat()
    
    jobs = await db.jobs.find(
        {"status": "completed", "completed_at": {"$gte": month_ago_str}},
        {"_id": 0}
    ).to_list(1000)
    
    machine_stats = {}
    operator_stats = {}
    
    for job in jobs:
        machine = job["machine_name"]
        operator = job.get("operator_name", "Unknown")
        koli = job["completed_koli"]
        
        if machine not in machine_stats:
            machine_stats[machine] = 0
        machine_stats[machine] += koli
        
        if operator not in operator_stats:
            operator_stats[operator] = 0
        operator_stats[operator] += koli
    
    return {
        "machine_stats": machine_stats,
        "operator_stats": operator_stats
    }

@api_router.get("/analytics/export")
async def export_analytics(period: str = "weekly"):
    from datetime import timedelta
    
    if period == "weekly":
        date_ago = datetime.now(timezone.utc) - timedelta(days=7)
    else:
        date_ago = datetime.now(timezone.utc) - timedelta(days=30)
    
    date_ago_str = date_ago.isoformat()
    
    jobs = await db.jobs.find(
        {"status": "completed", "completed_at": {"$gte": date_ago_str}},
        {"_id": 0}
    ).to_list(1000)
    
    wb = Workbook()
    ws = wb.active
    ws.title = "Üretim Raporu"
    
    header_fill = PatternFill(start_color="FFBF00", end_color="FFBF00", fill_type="solid")
    header_font = Font(bold=True, size=12)
    
    headers = ["İş Adı", "Makine", "Operatör", "Koli Sayısı", "Başlangıç", "Tamamlanma"]
    for col, header in enumerate(headers, start=1):
        cell = ws.cell(row=1, column=col, value=header)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal="center")
    
    for row, job in enumerate(jobs, start=2):
        ws.cell(row=row, column=1, value=job["name"])
        ws.cell(row=row, column=2, value=job["machine_name"])
        ws.cell(row=row, column=3, value=job.get("operator_name", "Unknown"))
        ws.cell(row=row, column=4, value=job["completed_koli"])
        ws.cell(row=row, column=5, value=job.get("started_at", ""))
        ws.cell(row=row, column=6, value=job.get("completed_at", ""))
    
    for col in range(1, 7):
        ws.column_dimensions[chr(64 + col)].width = 20
    
    output = BytesIO()
    wb.save(output)
    output.seek(0)
    
    filename = f"uretim_raporu_{period}.xlsx"
    
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@api_router.post("/warehouse-requests", response_model=WarehouseRequest)
async def create_warehouse_request(request: WarehouseRequest):
    doc = request.model_dump()
    await db.warehouse_requests.insert_one(doc)
    return request

@api_router.get("/warehouse-requests", response_model=List[WarehouseRequest])
async def get_warehouse_requests(status: Optional[str] = None):
    query = {}
    if status:
        query["status"] = status
    requests = await db.warehouse_requests.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    return requests

@api_router.put("/warehouse-requests/{request_id}/complete")
async def complete_warehouse_request(request_id: str):
    await db.warehouse_requests.update_one(
        {"id": request_id},
        {"$set": {"status": "completed"}}
    )
    return {"message": "Request completed"}

@api_router.post("/pallets", response_model=PalletScan)
async def scan_pallet(pallet: PalletScan):
    doc = pallet.model_dump()
    await db.pallets.insert_one(doc)
    return pallet

@api_router.get("/pallets", response_model=List[PalletScan])
async def get_pallets():
    pallets = await db.pallets.find({}, {"_id": 0}).sort("scanned_at", -1).to_list(100)
    return pallets

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
