from fastapi import APIRouter, Body
from typing import List
from datetime import datetime, timezone

from database import db
from models import Machine, MaintenanceLog

router = APIRouter()


@router.post("/machines/init")
async def init_machines():
    machine_names = ["40x40", "40x40 ICM", "33x33 (Büyük)", "33x33 ICM", "33x33 (Eski)", "30x30", "24x24", "Dispanser"]
    existing = await db.machines.count_documents({})
    if existing == 0:
        machines = [Machine(name=name).model_dump() for name in machine_names]
        await db.machines.insert_many(machines)
    return {"message": "Machines initialized"}


@router.get("/machines", response_model=List[Machine])
async def get_machines():
    machines = await db.machines.find({}, {"_id": 0}).to_list(100)
    return machines


@router.put("/machines/{machine_id}/maintenance")
async def toggle_maintenance(machine_id: str, data: dict = Body(...)):
    maintenance = data.get("maintenance", False)
    reason = data.get("reason", "")

    machine = await db.machines.find_one({"id": machine_id}, {"_id": 0})
    if not machine:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Machine not found")

    update_data = {"maintenance": maintenance}

    if maintenance:
        update_data["maintenance_reason"] = reason
        update_data["maintenance_started"] = datetime.now(timezone.utc).isoformat()
        log = MaintenanceLog(machine_id=machine_id, machine_name=machine["name"], reason=reason)
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


@router.get("/maintenance-logs", response_model=List[MaintenanceLog])
async def get_maintenance_logs():
    logs = await db.maintenance_logs.find({}, {"_id": 0}).sort("started_at", -1).to_list(100)
    return logs


@router.post("/machines/cleanup")
async def cleanup_duplicate_machines():
    machines = await db.machines.find({}, {"_id": 0}).to_list(1000)
    seen_names = {}
    duplicates_to_delete = []

    for machine in machines:
        if machine["name"] in seen_names:
            duplicates_to_delete.append(machine["id"])
        else:
            seen_names[machine["name"]] = machine["id"]

    if duplicates_to_delete:
        await db.machines.delete_many({"id": {"$in": duplicates_to_delete}})

    return {"message": f"Cleaned up {len(duplicates_to_delete)} duplicate machines"}
