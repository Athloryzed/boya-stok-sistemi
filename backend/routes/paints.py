from fastapi import APIRouter, HTTPException, Body
from typing import List, Optional
from datetime import datetime, timezone, timedelta
import os
import uuid
import logging

from database import db
from models import Paint, PaintMovement, ActivePaintToMachine
from emergentintegrations.llm.chat import LlmChat, UserMessage

router = APIRouter()

INITIAL_PAINTS = [
    "Siyah", "Beyaz", "Mavi", "Lacivert", "Refleks", "Kırmızı",
    "Magenta", "Rhodam", "Sarı", "Gold", "Gümüş", "Pasta"
]
LOW_STOCK_THRESHOLD = 5.0

logger = logging.getLogger(__name__)


@router.post("/paints/init")
async def init_paints():
    """Başlangıç boyalarını oluştur"""
    existing = await db.paints.count_documents({})
    if existing == 0:
        paints = [Paint(name=name).model_dump() for name in INITIAL_PAINTS]
        await db.paints.insert_many(paints)
        return {"message": f"{len(INITIAL_PAINTS)} boya eklendi"}
    return {"message": "Boyalar zaten mevcut"}


@router.get("/paints", response_model=List[Paint])
async def get_paints():
    paints = await db.paints.find({}, {"_id": 0}).sort("name", 1).to_list(100)
    return paints


@router.post("/paints", response_model=Paint)
async def create_paint(paint: Paint):
    doc = paint.model_dump()
    await db.paints.insert_one(doc)
    return paint


@router.delete("/paints/{paint_id}")
async def delete_paint(paint_id: str):
    result = await db.paints.delete_one({"id": paint_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Boya bulunamadı")
    return {"message": "Boya silindi"}


@router.delete("/paints/movements/clear")
async def clear_paint_movements():
    result = await db.paint_movements.delete_many({})
    return {"message": f"{result.deleted_count} hareket silindi"}


@router.post("/paints/transaction")
async def paint_transaction(data: dict = Body(...)):
    """Boya hareketi kaydet"""
    paint_id = data.get("paint_id")
    movement_type = data.get("movement_type")
    amount_kg = float(data.get("amount_kg", 0))
    machine_id = data.get("machine_id")
    machine_name = data.get("machine_name")
    note = data.get("note", "")

    paint = await db.paints.find_one({"id": paint_id}, {"_id": 0})
    if not paint:
        raise HTTPException(status_code=404, detail="Boya bulunamadı")

    current_stock = paint.get("stock_kg", 0)

    if movement_type in ("add", "from_machine"):
        new_stock = current_stock + amount_kg
    elif movement_type in ("remove", "to_machine"):
        if current_stock < amount_kg:
            raise HTTPException(status_code=400, detail=f"Yetersiz stok! Mevcut: {current_stock} kg")
        new_stock = current_stock - amount_kg
    else:
        raise HTTPException(status_code=400, detail="Geçersiz hareket tipi")

    await db.paints.update_one({"id": paint_id}, {"$set": {"stock_kg": new_stock}})

    movement = PaintMovement(
        paint_id=paint_id, paint_name=paint["name"],
        movement_type=movement_type, amount_kg=amount_kg,
        machine_id=machine_id, machine_name=machine_name, note=note
    )
    await db.paint_movements.insert_one(movement.model_dump())

    return {"message": "Hareket kaydedildi", "new_stock": new_stock, "movement_id": movement.id}


@router.get("/paints/movements", response_model=List[PaintMovement])
async def get_paint_movements(paint_id: Optional[str] = None, limit: int = 100):
    query = {}
    if paint_id:
        query["paint_id"] = paint_id
    movements = await db.paint_movements.find(query, {"_id": 0}).sort("created_at", -1).to_list(limit)
    return movements


@router.post("/paints/give-to-machine")
async def give_paint_to_machine(data: dict = Body(...)):
    """Makineye boya ver"""
    paint_id = data.get("paint_id")
    machine_id = data.get("machine_id")
    machine_name = data.get("machine_name")
    given_amount_kg = float(data.get("amount_kg", 0))

    if given_amount_kg <= 0:
        raise HTTPException(status_code=400, detail="Geçerli bir miktar girin")

    paint = await db.paints.find_one({"id": paint_id}, {"_id": 0})
    if not paint:
        raise HTTPException(status_code=404, detail="Boya bulunamadı")

    current_stock = paint.get("stock_kg", 0)
    if current_stock < given_amount_kg:
        raise HTTPException(status_code=400, detail=f"Yetersiz stok! Mevcut: {current_stock} kg")

    active_paint = ActivePaintToMachine(
        paint_id=paint_id, paint_name=paint["name"],
        machine_id=machine_id, machine_name=machine_name,
        given_amount_kg=given_amount_kg
    )
    await db.active_paints_to_machine.insert_one(active_paint.model_dump())

    new_stock = current_stock - given_amount_kg
    await db.paints.update_one({"id": paint_id}, {"$set": {"stock_kg": new_stock}})

    movement = PaintMovement(
        paint_id=paint_id, paint_name=paint["name"],
        movement_type="to_machine", amount_kg=given_amount_kg,
        machine_id=machine_id, machine_name=machine_name,
        note=f"Makineye verildi: {given_amount_kg} kg"
    )
    await db.paint_movements.insert_one(movement.model_dump())

    return {
        "message": f"{paint['name']} - {given_amount_kg} kg {machine_name} makinesine verildi",
        "active_paint_id": active_paint.id, "new_stock": new_stock
    }


@router.get("/paints/active-on-machines")
async def get_active_paints_on_machines():
    active_paints = await db.active_paints_to_machine.find(
        {"returned": False}, {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    return active_paints


@router.post("/paints/return-from-machine")
async def return_paint_from_machine(data: dict = Body(...)):
    """Makineden boya geri al"""
    active_paint_id = data.get("active_paint_id")
    returned_amount_kg = float(data.get("returned_amount_kg", 0))

    if returned_amount_kg < 0:
        raise HTTPException(status_code=400, detail="Geçersiz miktar")

    active_paint = await db.active_paints_to_machine.find_one(
        {"id": active_paint_id, "returned": False}, {"_id": 0}
    )
    if not active_paint:
        raise HTTPException(status_code=404, detail="Aktif boya kaydı bulunamadı")

    given_amount = active_paint["given_amount_kg"]
    used_amount = given_amount - returned_amount_kg

    if used_amount < 0:
        raise HTTPException(status_code=400, detail="Geri alınan miktar verilen miktardan fazla olamaz")

    await db.active_paints_to_machine.update_one(
        {"id": active_paint_id},
        {"$set": {
            "returned": True, "returned_amount_kg": returned_amount_kg,
            "used_amount_kg": used_amount,
            "returned_at": datetime.now(timezone.utc).isoformat()
        }}
    )

    paint = await db.paints.find_one({"id": active_paint["paint_id"]}, {"_id": 0})
    if paint:
        new_stock = paint.get("stock_kg", 0) + returned_amount_kg
        await db.paints.update_one({"id": active_paint["paint_id"]}, {"$set": {"stock_kg": new_stock}})

    movement_return = PaintMovement(
        paint_id=active_paint["paint_id"], paint_name=active_paint["paint_name"],
        movement_type="from_machine", amount_kg=returned_amount_kg,
        machine_id=active_paint["machine_id"], machine_name=active_paint["machine_name"],
        note=f"Makineden geri alındı: {returned_amount_kg} kg"
    )
    await db.paint_movements.insert_one(movement_return.model_dump())

    if used_amount > 0:
        movement_used = PaintMovement(
            paint_id=active_paint["paint_id"], paint_name=active_paint["paint_name"],
            movement_type="used", amount_kg=used_amount,
            machine_id=active_paint["machine_id"], machine_name=active_paint["machine_name"],
            note=f"Makine kullanımı: {used_amount} kg (Verilen: {given_amount} kg, Kalan: {returned_amount_kg} kg)"
        )
        await db.paint_movements.insert_one(movement_used.model_dump())

    return {
        "message": f"{active_paint['paint_name']} - {active_paint['machine_name']} makinesinden geri alındı",
        "given_amount": given_amount, "returned_amount": returned_amount_kg,
        "used_amount": used_amount,
        "new_stock": paint.get("stock_kg", 0) + returned_amount_kg if paint else 0
    }


@router.get("/paints/analytics")
async def get_paint_analytics(period: str = "weekly"):
    """Boya tüketim analitiği"""
    if period == "weekly":
        date_ago = datetime.now(timezone.utc) - timedelta(days=7)
    else:
        date_ago = datetime.now(timezone.utc) - timedelta(days=30)

    date_ago_str = date_ago.isoformat()

    movements = await db.paint_movements.find(
        {"movement_type": {"$in": ["remove", "used"]}, "created_at": {"$gte": date_ago_str}},
        {"_id": 0}
    ).to_list(1000)

    paint_consumption = {}
    machine_consumption = {}
    daily_consumption = {}

    for mov in movements:
        paint_name = mov["paint_name"]
        amount = mov["amount_kg"]
        machine_name = mov.get("machine_name", "Bilinmeyen")

        if paint_name not in paint_consumption:
            paint_consumption[paint_name] = 0
        paint_consumption[paint_name] += amount

        if mov["movement_type"] == "used" and machine_name and machine_name != "Bilinmeyen":
            if machine_name not in machine_consumption:
                machine_consumption[machine_name] = 0
            machine_consumption[machine_name] += amount

        date_str = mov["created_at"][:10]
        if date_str not in daily_consumption:
            daily_consumption[date_str] = 0
        daily_consumption[date_str] += amount

    return {
        "period": period,
        "paint_consumption": paint_consumption,
        "machine_consumption": machine_consumption,
        "daily_consumption": daily_consumption,
        "total_consumed": sum(paint_consumption.values())
    }


@router.get("/paints/low-stock")
async def get_low_stock_paints():
    """Düşük stoklu boyaları listele"""
    paints = await db.paints.find({"stock_kg": {"$lt": LOW_STOCK_THRESHOLD}}, {"_id": 0}).to_list(100)
    return {"threshold": LOW_STOCK_THRESHOLD, "low_stock_paints": paints}


@router.get("/ai/paint-forecast")
async def get_ai_paint_forecast():
    """AI destekli boya tüketim tahmini"""
    llm_key = os.environ.get("EMERGENT_LLM_KEY")
    if not llm_key:
        raise HTTPException(status_code=500, detail="AI servisi yapılandırılmamış")

    paints = await db.paints.find({}, {"_id": 0}).to_list(100)

    two_weeks_ago = (datetime.now(timezone.utc) - timedelta(days=14)).isoformat()
    movements = await db.paint_movements.find(
        {"movement_type": {"$in": ["remove", "used"]}, "created_at": {"$gte": two_weeks_ago}},
        {"_id": 0}
    ).to_list(1000)

    pending_jobs = await db.jobs.find(
        {"status": {"$in": ["pending", "in_progress"]}}, {"_id": 0}
    ).to_list(200)

    paint_usage_14d = {}
    for mov in movements:
        pn = mov["paint_name"]
        paint_usage_14d[pn] = paint_usage_14d.get(pn, 0) + mov["amount_kg"]

    stock_lines = []
    forecasts = []
    for p in paints:
        name = p["name"]
        stock = p.get("stock_kg", 0)
        usage_14d = paint_usage_14d.get(name, 0)
        daily_avg = round(usage_14d / 14, 2) if usage_14d > 0 else 0
        days_left = round(stock / daily_avg) if daily_avg > 0 else None

        stock_lines.append(
            f"- {name}: Stok={stock}L, 14g tüketim={round(usage_14d,1)}L, Günlük ort={daily_avg}L, Tahmini kalan={days_left} gün"
            if days_left else f"- {name}: Stok={stock}L, 14g tüketim=0L"
        )

        forecasts.append({
            "name": name, "stock": stock, "usage_14d": round(usage_14d, 1),
            "daily_avg": daily_avg, "days_left": days_left,
            "critical": days_left is not None and days_left <= 3
        })

    job_colors = [j.get("colors", "") for j in pending_jobs if j.get("colors")]

    context = f"""BOYA STOK DURUMU
{chr(10).join(stock_lines)}

Bekleyen İşlerin Renkleri: {', '.join(job_colors[:20]) if job_colors else 'Bilgi yok'}
Toplam Bekleyen İş: {len(pending_jobs)}"""

    try:
        chat = LlmChat(
            api_key=llm_key,
            session_id=f"paint_forecast_{uuid.uuid4().hex[:8]}",
            system_message="""Sen bir boya stok yönetim uzmanısın. Türkçe yanıt ver. Emoji kullanma.
Verilen verilere göre:
1. Kritik durumda olan boyaları belirt (3 gün içinde bitecekler)
2. Sipariş verilmesi gerekenleri öner
3. Bekleyen işlere göre hangi boyalara ihtiyaç olacağını tahmin et
4. Genel stok durumu özeti ver
Kısa ve net maddeler halinde yaz. Maksimum 6 madde."""
        ).with_model("openai", "gpt-5.2")

        response = await chat.send_message(UserMessage(text=f"Boya stok durumunu analiz et:\n{context}"))

        return {
            "forecast": response,
            "paints": sorted(forecasts, key=lambda x: (x["days_left"] or 999)),
            "critical_count": sum(1 for f in forecasts if f["critical"]),
            "total_paints": len(paints)
        }
    except Exception as e:
        logger.error(f"AI paint forecast error: {e}")
        raise HTTPException(status_code=500, detail=f"AI servisi hatası: {str(e)}")
