from fastapi import APIRouter, Body, Depends
from typing import Optional

from database import db
from models import Pallet, PalletScan
from services.audit import log_audit
from auth import get_current_user

router = APIRouter(dependencies=[Depends(get_current_user)])


@router.post("/pallets")
async def create_pallet(data: dict = Body(...)):
    """Yeni palet oluştur/tara"""
    pallet_code = data.get("pallet_code") or data.get("code", "")

    if data.get("machine_id"):
        pallet = Pallet(
            code=pallet_code,
            job_id=data.get("job_id", ""),
            job_name=data.get("job_name", ""),
            machine_id=data.get("machine_id", ""),
            machine_name=data.get("machine_name", ""),
            koli_count=data.get("koli_count", 0),
            operator_name=data.get("operator_name", "")
        )
        doc = pallet.model_dump()
        await db.pallets.insert_one(doc)
        await log_audit(data.get("operator_name", "Depo"), "create", "pallet", pallet_code, f"Is: {data.get('job_name', '')}")
        return {k: v for k, v in doc.items() if k != "_id"}
    else:
        scan = PalletScan(
            pallet_code=pallet_code,
            job_id=data.get("job_id", "unknown"),
            job_name=data.get("job_name", ""),
            operator_name=data.get("operator_name", "")
        )
        doc = scan.model_dump()
        await db.pallets.insert_one(doc)
        await log_audit(data.get("operator_name", "Depo"), "create", "pallet", pallet_code, f"Tarama - Is: {data.get('job_name', '')}")
        return {k: v for k, v in doc.items() if k != "_id"}


@router.get("/pallets")
async def get_pallets(job_id: Optional[str] = None, status: Optional[str] = None):
    query = {}
    if job_id:
        query["job_id"] = job_id
    if status:
        query["status"] = status
    pallets = await db.pallets.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    return pallets


@router.get("/pallets/by-job/{job_id}")
async def get_pallets_by_job(job_id: str):
    pallets = await db.pallets.find({"job_id": job_id}, {"_id": 0}).to_list(100)
    total_koli = sum(p["koli_count"] for p in pallets)
    return {"pallets": pallets, "total_pallets": len(pallets), "total_koli": total_koli}


@router.get("/pallets/search")
async def search_pallets(q: str):
    pallets = await db.pallets.find({
        "$or": [
            {"code": {"$regex": q, "$options": "i"}},
            {"job_name": {"$regex": q, "$options": "i"}}
        ]
    }, {"_id": 0}).to_list(50)
    return pallets


@router.put("/pallets/{pallet_id}/status")
async def update_pallet_status(pallet_id: str, data: dict = Body(...)):
    status = data.get("status")
    await db.pallets.update_one({"id": pallet_id}, {"$set": {"status": status}})
    return {"success": True}
