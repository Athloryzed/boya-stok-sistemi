from fastapi import APIRouter, HTTPException, Body
from typing import List, Optional
from datetime import datetime, timezone

from database import db
from models import WarehouseRequest, WarehouseShipmentLog
from websocket_manager import ws_manager

router = APIRouter()


@router.post("/warehouse-requests", response_model=WarehouseRequest)
async def create_warehouse_request(request: WarehouseRequest):
    doc = request.model_dump()
    await db.warehouse_requests.insert_one(doc)

    await ws_manager.broadcast({
        "type": "new_warehouse_request",
        "data": {
            "id": request.id, "operator_name": request.operator_name,
            "machine_name": request.machine_name, "item_type": request.item_type,
            "quantity": request.quantity, "created_at": request.created_at
        }
    })

    return request


@router.get("/warehouse-requests", response_model=List[WarehouseRequest])
async def get_warehouse_requests(status: Optional[str] = None):
    query = {}
    if status:
        query["status"] = status
    requests = await db.warehouse_requests.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    return requests


@router.put("/warehouse-requests/{request_id}/complete")
async def complete_warehouse_request(request_id: str):
    await db.warehouse_requests.update_one(
        {"id": request_id}, {"$set": {"status": "completed"}}
    )
    return {"message": "Request completed"}


@router.post("/warehouse/shipment-log")
async def create_warehouse_shipment_log(data: dict = Body(...)):
    """Depo sevkiyat kaydı oluştur"""
    log = WarehouseShipmentLog(
        shipment_id=data.get("shipment_id"),
        vehicle_plate=data.get("vehicle_plate"),
        pallet_ids=data.get("pallet_ids", []),
        total_koli=data.get("total_koli", 0),
        partial=data.get("partial", False),
        delivered_koli=data.get("delivered_koli", 0),
        operator_name=data.get("operator_name", "Depo")
    )
    await db.warehouse_shipment_logs.insert_one(log.model_dump())
    return log


@router.get("/warehouse/shipment-logs")
async def get_warehouse_shipment_logs(limit: int = 100):
    """Depo sevkiyat kayıtlarını listele"""
    logs = await db.warehouse_shipment_logs.find({}, {"_id": 0}).sort("created_at", -1).to_list(limit)
    return logs
