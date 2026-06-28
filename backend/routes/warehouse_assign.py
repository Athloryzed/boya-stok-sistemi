"""
Warehouse Assignment & Transfer — Depo1/Depo2 atama + transfer log.
"""
from fastapi import APIRouter, HTTPException, Body, Depends, Query
from typing import Optional
from datetime import datetime, timezone
import uuid

from database import db
from auth import get_current_user
from services.audit import log_audit

router = APIRouter(dependencies=[Depends(get_current_user)])

WAREHOUSES = ["DEPO1", "DEPO2"]


def _now_iso():
    return datetime.now(timezone.utc).isoformat()


@router.get("/warehouse-summary")
async def warehouse_summary():
    """Her depo için: bobin sayısı, marka-stok ürün sayısı, kritik stok adedi."""
    result = {}
    for w in WAREHOUSES + ["UNASSIGNED"]:
        if w == "UNASSIGNED":
            base_q = {"$or": [{"warehouse": {"$exists": False}}, {"warehouse": None}, {"warehouse": ""}]}
        else:
            base_q = {"warehouse": w}
        bobins = await db.bobins.count_documents(base_q)
        # Bobin kritik — total_weight_kg eşiği (örn. < 50 kg = kritik)
        crit_bobins = await db.bobins.count_documents({**base_q, "total_weight_kg": {"$lt": 50}})
        ms_items = await db.brand_stock.count_documents(base_q)
        # Marka stok kritik — quantity < 10 = kritik
        crit_ms = await db.brand_stock.count_documents({**base_q, "quantity": {"$lt": 10}})
        result[w] = {
            "bobin_count": bobins,
            "bobin_critical": crit_bobins,
            "marka_stok_count": ms_items,
            "marka_stok_critical": crit_ms,
        }
    return result


@router.post("/warehouse-transfer")
async def transfer_item(payload: dict = Body(...), user=Depends(get_current_user)):
    """payload: { item_type, item_id, to_warehouse, notes? }"""
    item_type = (payload.get("item_type") or "").strip()
    item_id = (payload.get("item_id") or "").strip()
    to_w = (payload.get("to_warehouse") or "").strip() or None
    notes = (payload.get("notes") or "").strip() or None

    if item_type not in ("bobin", "marka_stok"):
        raise HTTPException(400, "Geçersiz item_type")
    if to_w and to_w not in WAREHOUSES:
        raise HTTPException(400, f"Depo {WAREHOUSES} veya boş olmalı")

    collection = db.bobins if item_type == "bobin" else db.brand_stock
    item = await collection.find_one({"id": item_id}, {"_id": 0})
    if not item:
        raise HTTPException(404, "Ürün bulunamadı")

    from_w = item.get("warehouse") or None
    if from_w == to_w:
        return {"ok": True, "no_change": True, "message": "Zaten o depoda"}

    await collection.update_one(
        {"id": item_id},
        {"$set": {"warehouse": to_w, "warehouse_updated_at": _now_iso()}}
    )

    name = item.get("name") or item.get("color") or item.get("brand") or item_id[:8]
    if item_type == "bobin":
        # Daha açıklayıcı isim
        parts = [item.get("brand", ""), f"{item.get('width_cm','')}cm", f"{item.get('grammage','')}gr", item.get("color", "")]
        name = " ".join([p for p in parts if p])
    elif item_type == "marka_stok":
        parts = [item.get("brand", "")]
        if item.get("machine"):
            parts.append(item.get("machine"))
        if item.get("color"):
            parts.append(item.get("color"))
        name = " · ".join([p for p in parts if p])
    log_entry = {
        "id": str(uuid.uuid4()),
        "item_type": item_type,
        "item_id": item_id,
        "item_name": name,
        "from_warehouse": from_w,
        "to_warehouse": to_w,
        "by_user": user.get("display_name") or user.get("username") or "system",
        "at": _now_iso(),
        "notes": notes,
    }
    await db.warehouse_transfers.insert_one(log_entry)
    log_entry.pop("_id", None)
    try:
        await log_audit(
            user.get("username") or "system", "transfer", item_type,
            name, f"{from_w or 'Atanmamış'} → {to_w or 'Atanmamış'}"
        )
    except Exception:
        pass
    return {"ok": True, "log": log_entry}


@router.get("/warehouse-transfers")
async def list_transfers(
    limit: int = 100,
    item_type: Optional[str] = None,
    warehouse: Optional[str] = None,
):
    q = {}
    if item_type in ("bobin", "marka_stok"):
        q["item_type"] = item_type
    if warehouse in WAREHOUSES:
        q["$or"] = [{"from_warehouse": warehouse}, {"to_warehouse": warehouse}]
    items = await db.warehouse_transfers.find(q, {"_id": 0}).sort("at", -1).limit(limit).to_list(limit)
    return items
