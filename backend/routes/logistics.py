from fastapi import APIRouter, HTTPException, Body
from typing import Optional
from datetime import datetime, timezone

from database import db
from models import Vehicle, Shipment, Driver

router = APIRouter()


# ==================== ARAÇ YÖNETİMİ ====================

@router.post("/vehicles", response_model=Vehicle)
async def create_vehicle(data: dict = Body(...)):
    vehicle = Vehicle(plate=data.get("plate"), driver_name=data.get("driver_name"))
    await db.vehicles.insert_one(vehicle.model_dump())
    return vehicle


@router.get("/vehicles")
async def get_vehicles():
    vehicles = await db.vehicles.find({"is_active": True}, {"_id": 0}).to_list(100)
    return vehicles


@router.delete("/vehicles/{vehicle_id}")
async def delete_vehicle(vehicle_id: str):
    await db.vehicles.update_one({"id": vehicle_id}, {"$set": {"is_active": False}})
    return {"success": True}


# ==================== SEVKİYAT YÖNETİMİ ====================

@router.post("/shipments", response_model=Shipment)
async def create_shipment(data: dict = Body(...)):
    pallet_ids = data.get("pallet_ids", [])

    total_koli = 0
    if pallet_ids:
        pallets = await db.pallets.find({"id": {"$in": pallet_ids}}, {"_id": 0}).to_list(100)
        total_koli = sum(p["koli_count"] for p in pallets)
        await db.pallets.update_many(
            {"id": {"$in": pallet_ids}}, {"$set": {"status": "in_shipment"}}
        )

    shipment = Shipment(
        vehicle_id=data.get("vehicle_id"), vehicle_plate=data.get("vehicle_plate"),
        driver_id=data.get("driver_id"), driver_name=data.get("driver_name"),
        pallets=pallet_ids, total_koli=data.get("total_koli", total_koli),
        delivery_address=data.get("delivery_address"),
        delivery_phone=data.get("delivery_phone"),
        delivery_notes=data.get("delivery_notes"),
        created_by=data.get("created_by", "plan")
    )
    await db.shipments.insert_one(shipment.model_dump())
    return shipment


@router.get("/shipments")
async def get_shipments(status: Optional[str] = None, driver_id: Optional[str] = None):
    query = {}
    if status:
        query["status"] = status
    if driver_id:
        query["driver_id"] = driver_id
    shipments = await db.shipments.find(query, {"_id": 0}).sort("created_at", -1).to_list(200)
    return shipments


@router.get("/shipments/{shipment_id}")
async def get_shipment(shipment_id: str):
    shipment = await db.shipments.find_one({"id": shipment_id}, {"_id": 0})
    if not shipment:
        raise HTTPException(status_code=404, detail="Sevkiyat bulunamadı")
    pallets = await db.pallets.find({"id": {"$in": shipment.get("pallets", [])}}, {"_id": 0}).to_list(100)
    shipment["pallet_details"] = pallets
    return shipment


@router.put("/shipments/{shipment_id}")
async def update_shipment(shipment_id: str, data: dict = Body(...)):
    update_data = {}
    for key in ["delivery_address", "delivery_phone", "delivery_notes", "total_koli", "driver_id", "driver_name", "vehicle_id", "vehicle_plate"]:
        if key in data:
            update_data[key] = data[key]

    if "pallet_ids" in data:
        update_data["pallets"] = data["pallet_ids"]
        await db.pallets.update_many(
            {"id": {"$in": data["pallet_ids"]}}, {"$set": {"status": "in_shipment"}}
        )

    await db.shipments.update_one({"id": shipment_id}, {"$set": update_data})
    return {"success": True}


@router.put("/shipments/{shipment_id}/status")
async def update_shipment_status(shipment_id: str, data: dict = Body(...)):
    status = data.get("status")
    reason = data.get("reason")

    update_data = {"status": status}
    if status == "in_transit":
        update_data["started_at"] = datetime.now(timezone.utc).isoformat()
    elif status in ["delivered", "failed"]:
        update_data["completed_at"] = datetime.now(timezone.utc).isoformat()
        if reason:
            update_data["delivery_status_reason"] = reason

        shipment = await db.shipments.find_one({"id": shipment_id}, {"_id": 0})
        if shipment:
            pallet_status = "delivered" if status == "delivered" else "in_warehouse"
            await db.pallets.update_many(
                {"id": {"$in": shipment.get("pallets", [])}},
                {"$set": {"status": pallet_status}}
            )

    await db.shipments.update_one({"id": shipment_id}, {"$set": update_data})
    return {"success": True}


@router.delete("/shipments/{shipment_id}")
async def delete_shipment(shipment_id: str):
    shipment = await db.shipments.find_one({"id": shipment_id}, {"_id": 0})
    if shipment:
        await db.pallets.update_many(
            {"id": {"$in": shipment.get("pallets", [])}},
            {"$set": {"status": "in_warehouse"}}
        )
    await db.shipments.delete_one({"id": shipment_id})
    return {"success": True}


# ==================== ŞOFÖR YÖNETİMİ ====================

@router.post("/drivers", response_model=Driver)
async def create_driver(data: dict = Body(...)):
    driver = Driver(name=data.get("name"), password=data.get("password"), phone=data.get("phone"))
    await db.drivers.insert_one(driver.model_dump())
    return driver


@router.get("/drivers")
async def get_drivers():
    drivers = await db.drivers.find({"is_active": True}, {"_id": 0, "password": 0}).to_list(100)
    return drivers


@router.post("/drivers/login")
async def driver_login(data: dict = Body(...)):
    name = data.get("name")
    password = data.get("password")
    driver = await db.drivers.find_one(
        {"name": name, "password": password, "is_active": True}, {"_id": 0}
    )
    if not driver:
        raise HTTPException(status_code=401, detail="Geçersiz kullanıcı adı veya şifre")
    driver.pop("password", None)
    return driver


@router.put("/drivers/{driver_id}/location")
async def update_driver_location(driver_id: str, data: dict = Body(...)):
    lat = data.get("lat")
    lng = data.get("lng")
    await db.drivers.update_one(
        {"id": driver_id},
        {"$set": {
            "current_location_lat": lat, "current_location_lng": lng,
            "location_updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    return {"success": True}


@router.get("/drivers/{driver_id}/location")
async def get_driver_location(driver_id: str):
    driver = await db.drivers.find_one({"id": driver_id}, {"_id": 0, "password": 0})
    if not driver:
        raise HTTPException(status_code=404, detail="Şoför bulunamadı")
    return {
        "lat": driver.get("current_location_lat"),
        "lng": driver.get("current_location_lng"),
        "updated_at": driver.get("location_updated_at")
    }


@router.get("/drivers/{driver_id}/shipments")
async def get_driver_shipments(driver_id: str):
    shipments = await db.shipments.find({
        "driver_id": driver_id,
        "status": {"$in": ["preparing", "in_transit"]}
    }, {"_id": 0}).sort("created_at", -1).to_list(50)
    return shipments
