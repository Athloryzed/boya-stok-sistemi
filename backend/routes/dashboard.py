from fastapi import APIRouter
from datetime import datetime, timezone, timedelta

from database import db

router = APIRouter()


@router.get("/dashboard/live")
async def get_live_dashboard():
    """Canlı üretim panosu verisi"""
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()

    all_machines = await db.machines.find({}, {"_id": 0}).to_list(50)
    active_jobs = await db.jobs.find({"status": "in_progress"}, {"_id": 0}).to_list(50)
    pending_jobs = await db.jobs.find({"status": "pending"}, {"_id": 0}).to_list(200)

    completed_today = await db.jobs.find(
        {"status": "completed", "completed_at": {"$gte": today_start}}, {"_id": 0}
    ).to_list(200)

    completed_7d = await db.jobs.find(
        {"status": "completed", "completed_at": {"$gte": week_ago}}, {"_id": 0}
    ).to_list(500)

    koli_today = sum(j.get("completed_koli", j.get("koli_count", 0)) for j in completed_today)

    machine_data = []
    for m in all_machines:
        active_job = next((j for j in active_jobs if j.get("machine_id") == m.get("id")), None)
        pending_count = sum(1 for j in pending_jobs if j.get("machine_id") == m.get("id"))
        machine_data.append({
            "name": m["name"],
            "status": m.get("status", "idle"),
            "active_job": {
                "name": active_job["name"],
                "koli_count": active_job.get("koli_count", 0),
                "operator_name": active_job.get("operator_name", ""),
                "started_at": active_job.get("started_at", "")
            } if active_job else None,
            "pending_jobs": pending_count
        })

    op_today = {}
    for j in completed_today:
        op = j.get("operator_name", "")
        if op:
            if op not in op_today:
                op_today[op] = {"jobs": 0, "koli": 0}
            op_today[op]["jobs"] += 1
            op_today[op]["koli"] += j.get("completed_koli", j.get("koli_count", 0))

    operator_ranking = [{"name": k, "jobs": v["jobs"], "koli": v["koli"]}
                        for k, v in sorted(op_today.items(), key=lambda x: x[1]["koli"], reverse=True)]

    daily_data = {}
    for j in completed_7d:
        date = j.get("completed_at", "")[:10]
        if date:
            daily_data[date] = daily_data.get(date, 0) + j.get("completed_koli", j.get("koli_count", 0))

    return {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "summary": {
            "total_machines": len(all_machines),
            "working": sum(1 for m in all_machines if m.get("status") == "working"),
            "idle": sum(1 for m in all_machines if m.get("status") == "idle"),
            "maintenance": sum(1 for m in all_machines if m.get("status") == "maintenance"),
            "koli_today": koli_today,
            "completed_today": len(completed_today),
            "pending_total": len(pending_jobs)
        },
        "machines": machine_data,
        "operator_ranking": operator_ranking,
        "daily_koli": [{"date": k, "koli": v} for k, v in sorted(daily_data.items())]
    }
