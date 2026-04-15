from fastapi import APIRouter, Body, Request, Depends
from datetime import datetime, timezone, timedelta

from database import db
from models import Visitor
from auth import get_current_user

router = APIRouter()


def parse_user_agent(user_agent: str) -> dict:
    """User agent string'inden cihaz bilgisi çıkar"""
    ua = user_agent.lower()

    if "mobile" in ua or "android" in ua and "mobile" in ua:
        device_type = "Mobil"
    elif "tablet" in ua or "ipad" in ua:
        device_type = "Tablet"
    else:
        device_type = "Masaüstü"

    if "windows" in ua:
        os_name = "Windows"
    elif "mac" in ua or "macintosh" in ua:
        os_name = "MacOS"
    elif "iphone" in ua:
        os_name = "iOS"
        device_type = "Mobil"
    elif "ipad" in ua:
        os_name = "iOS"
        device_type = "Tablet"
    elif "android" in ua:
        os_name = "Android"
    elif "linux" in ua:
        os_name = "Linux"
    else:
        os_name = "Bilinmeyen"

    if "chrome" in ua and "edg" not in ua:
        browser = "Chrome"
    elif "firefox" in ua:
        browser = "Firefox"
    elif "safari" in ua and "chrome" not in ua:
        browser = "Safari"
    elif "edg" in ua:
        browser = "Edge"
    elif "opera" in ua or "opr" in ua:
        browser = "Opera"
    else:
        browser = "Diğer"

    if "iphone" in ua:
        device_model = "iPhone"
    elif "ipad" in ua:
        device_model = "iPad"
    elif "samsung" in ua:
        device_model = "Samsung"
    elif "huawei" in ua:
        device_model = "Huawei"
    elif "xiaomi" in ua or "redmi" in ua:
        device_model = "Xiaomi"
    elif "pixel" in ua:
        device_model = "Google Pixel"
    elif "windows" in ua:
        device_model = "PC"
    elif "macintosh" in ua:
        device_model = "Mac"
    else:
        device_model = device_type

    return {
        "device_type": device_type,
        "device_model": device_model,
        "browser": browser,
        "os": os_name
    }


@router.post("/visitors/log")
async def log_visitor(request: Request, data: dict = Body(...)):
    """Ziyaretçi kaydı oluştur"""
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        ip_address = forwarded_for.split(",")[0].strip()
    else:
        ip_address = request.client.host if request.client else "Bilinmeyen"

    user_agent = data.get("user_agent", "")
    page_visited = data.get("page_visited", "/")

    device_info = parse_user_agent(user_agent)

    visitor = Visitor(
        ip_address=ip_address, user_agent=user_agent,
        device_type=device_info["device_type"],
        device_model=device_info["device_model"],
        browser=device_info["browser"],
        os=device_info["os"],
        page_visited=page_visited
    )

    await db.visitors.insert_one(visitor.model_dump())
    return {"message": "Ziyaret kaydedildi", "visitor_id": visitor.id}


@router.get("/visitors")
async def get_visitors(limit: int = 100, current_user: dict = Depends(get_current_user)):
    visitors = await db.visitors.find({}, {"_id": 0}).sort("visited_at", -1).to_list(limit)
    return visitors


@router.get("/visitors/stats")
async def get_visitor_stats(current_user: dict = Depends(get_current_user)):
    total = await db.visitors.count_documents({})

    day_ago = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
    today_count = await db.visitors.count_documents({"visited_at": {"$gte": day_ago}})

    week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    week_count = await db.visitors.count_documents({"visited_at": {"$gte": week_ago}})

    device_pipeline = [{"$group": {"_id": "$device_type", "count": {"$sum": 1}}}]
    device_stats = await db.visitors.aggregate(device_pipeline).to_list(10)

    return {
        "total_visitors": total, "today": today_count,
        "this_week": week_count,
        "device_distribution": {item["_id"]: item["count"] for item in device_stats}
    }


@router.delete("/visitors/clear")
async def clear_visitors(current_user: dict = Depends(get_current_user)):
    result = await db.visitors.delete_many({})
    return {"message": f"{result.deleted_count} kayıt silindi"}
