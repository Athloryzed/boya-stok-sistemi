from fastapi import APIRouter, Body
from typing import Optional
from datetime import datetime, timezone, timedelta

from database import db
from models import DefectLog

router = APIRouter()


@router.post("/defects")
async def create_defect_log(data: dict = Body(...)):
    """Defo kaydı oluştur"""
    defect_log = DefectLog(
        machine_id=data.get("machine_id"),
        machine_name=data.get("machine_name"),
        shift_id=data.get("shift_id"),
        defect_kg=float(data.get("defect_kg", 0)),
        notes=data.get("notes")
    )
    await db.defect_logs.insert_one(defect_log.model_dump())
    return defect_log


@router.get("/defects")
async def get_defect_logs(machine_id: Optional[str] = None, date: Optional[str] = None, limit: int = 100):
    """Defo kayıtlarını listele"""
    query = {}
    if machine_id:
        query["machine_id"] = machine_id
    if date:
        query["date"] = date
    defects = await db.defect_logs.find(query, {"_id": 0}).sort("created_at", -1).to_list(limit)
    return defects


@router.get("/defects/analytics/weekly")
async def get_defect_analytics_weekly():
    """Haftalık defo analitikleri"""
    start_date = datetime.now(timezone.utc) - timedelta(days=7)
    start_date_str = start_date.strftime("%Y-%m-%d")

    defects = await db.defect_logs.find(
        {"date": {"$gte": start_date_str}}, {"_id": 0}
    ).to_list(1000)

    machine_defects = {}
    daily_defects = {}
    total_defects = 0.0

    for defect in defects:
        machine = defect.get("machine_name", "Bilinmiyor")
        kg = float(defect.get("defect_kg", 0))
        date = defect.get("date", "")
        total_defects += kg

        if machine not in machine_defects:
            machine_defects[machine] = 0.0
        machine_defects[machine] += kg

        if date not in daily_defects:
            daily_defects[date] = 0.0
        daily_defects[date] += kg

    return {
        "total_defects_kg": round(total_defects, 2),
        "machine_defects": {k: round(v, 2) for k, v in machine_defects.items()},
        "daily_defects": {k: round(v, 2) for k, v in daily_defects.items()},
        "period": "weekly"
    }


@router.get("/defects/analytics/monthly")
async def get_defect_analytics_monthly(year: int = None, month: int = None):
    """Aylık defo analitikleri"""
    import calendar

    if year is None:
        year = datetime.now(timezone.utc).year
    if month is None:
        month = datetime.now(timezone.utc).month

    first_day = datetime(year, month, 1, tzinfo=timezone.utc)
    last_day_num = calendar.monthrange(year, month)[1]
    last_day = datetime(year, month, last_day_num, 23, 59, 59, tzinfo=timezone.utc)

    defects = await db.defect_logs.find(
        {"date": {"$gte": first_day.strftime("%Y-%m-%d"), "$lte": last_day.strftime("%Y-%m-%d")}},
        {"_id": 0}
    ).to_list(1000)

    machine_defects = {}
    daily_defects = {}
    total_defects = 0.0

    for defect in defects:
        machine = defect.get("machine_name", "Bilinmiyor")
        kg = float(defect.get("defect_kg", 0))
        date = defect.get("date", "")
        total_defects += kg

        if machine not in machine_defects:
            machine_defects[machine] = 0.0
        machine_defects[machine] += kg

        if date not in daily_defects:
            daily_defects[date] = 0.0
        daily_defects[date] += kg

    month_names = ["", "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
                   "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"]

    return {
        "total_defects_kg": round(total_defects, 2),
        "machine_defects": {k: round(v, 2) for k, v in machine_defects.items()},
        "daily_defects": {k: round(v, 2) for k, v in daily_defects.items()},
        "period": "monthly",
        "month_name": month_names[month],
        "year": year, "month": month
    }


@router.get("/defects/analytics/daily-by-week")
async def get_defect_analytics_daily_by_week(week_offset: int = 0):
    """Hafta bazında günlük defo analitikleri"""
    today = datetime.now(timezone.utc)
    days_since_monday = today.weekday()
    this_monday = today - timedelta(days=days_since_monday)
    target_monday = this_monday + timedelta(weeks=week_offset)
    target_sunday = target_monday + timedelta(days=6)

    daily_stats = []
    day_names = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"]

    for i in range(7):
        date = target_monday + timedelta(days=i)
        date_str = date.strftime("%Y-%m-%d")

        defects = await db.defect_logs.find({"date": date_str}, {"_id": 0}).to_list(100)

        total_kg = sum(float(d.get("defect_kg", 0)) for d in defects)
        machine_breakdown = {}
        for d in defects:
            machine = d.get("machine_name", "Bilinmiyor")
            if machine not in machine_breakdown:
                machine_breakdown[machine] = 0.0
            machine_breakdown[machine] += float(d.get("defect_kg", 0))

        daily_stats.append({
            "date": date.strftime("%d %b"),
            "day_name": day_names[i],
            "full_date": date_str,
            "total_kg": round(total_kg, 2),
            "machines": {k: round(v, 2) for k, v in machine_breakdown.items()}
        })

    return {
        "week_start": target_monday.strftime("%d %b %Y"),
        "week_end": target_sunday.strftime("%d %b %Y"),
        "week_offset": week_offset,
        "daily_stats": daily_stats
    }


@router.get("/defects/analytics")
async def get_defect_analytics(period: str = "weekly"):
    """Defo analitikleri (geriye uyumluluk)"""
    if period == "monthly":
        return await get_defect_analytics_monthly()
    return await get_defect_analytics_weekly()
