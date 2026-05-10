from fastapi import APIRouter, HTTPException, Body, Depends, Request
from datetime import datetime, timezone, timedelta
from slowapi import Limiter
from slowapi.util import get_remote_address
from rate_limit_utils import get_real_client_ip

from database import db
from auth import get_current_user, create_token, DASHBOARD_PASSWORD

router = APIRouter()
limiter = Limiter(key_func=get_real_client_ip)


@router.post("/dashboard/login")
@limiter.limit("60/minute")
async def dashboard_login(request: Request, data: dict = Body(...)):
    """Dashboard girisi - sifre dogrulama"""
    password = data.get("password", "")
    if password != DASHBOARD_PASSWORD:
        raise HTTPException(status_code=401, detail="Yanlis sifre")
    token = create_token("dashboard", "dashboard", "dashboard", "Dashboard")
    return {"success": True, "token": token}


@router.get("/dashboard/live")
async def get_live_dashboard(current_user: dict = Depends(get_current_user)):
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

    # Bugünkü vardiya raporları (kısmi üretimleri içerir)
    shift_reports_today = await db.shift_end_reports.find(
        {"created_at": {"$gte": today_start}}, {"_id": 0}
    ).to_list(1000)
    shift_reports_7d = await db.shift_end_reports.find(
        {"created_at": {"$gte": week_ago}}, {"_id": 0}
    ).to_list(2000)

    # Bugun tamamlanan islerin onceki kismi uretimlerini cikar (cifte sayim onleme)
    completed_today_ids = {j["id"] for j in completed_today}
    prior_partials_today = {}
    for r in shift_reports_today:
        jid = r.get("job_id")
        if jid and jid in completed_today_ids:
            prior_partials_today[jid] = prior_partials_today.get(jid, 0) + r.get("produced_koli", 0)

    # 1) Tamamlanan isler: completed_koli (onceki vardiyalar dahil) - bugun zaten raporlanmis kismi uretim
    koli_today = 0
    for j in completed_today:
        completed_koli = j.get("completed_koli", j.get("koli_count", 0))
        prior = prior_partials_today.get(j["id"], 0)
        koli_today += max(0, completed_koli - prior)

    # 2) Bugunku tum vardiya raporlari produced_koli'sini ekle
    for r in shift_reports_today:
        koli_today += r.get("produced_koli", 0)

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

    # Operator siralamasi: tamamlanan + bugunku kismi uretim
    op_today = {}
    for j in completed_today:
        op = j.get("operator_name", "")
        if op:
            if op not in op_today:
                op_today[op] = {"jobs": 0, "koli": 0}
            op_today[op]["jobs"] += 1
            credit = max(0, j.get("completed_koli", j.get("koli_count", 0)) - prior_partials_today.get(j["id"], 0))
            op_today[op]["koli"] += credit

    # Kismi uretimler (bugunku shift raporlarindan operator bilgisi job'tan turetilir)
    # ShiftEndReport'ta operator yok, job'tan cekiyoruz
    job_ids_in_reports = list({r.get("job_id") for r in shift_reports_today if r.get("job_id")})
    job_op_map = {}
    if job_ids_in_reports:
        jobs_for_ops = await db.jobs.find(
            {"id": {"$in": job_ids_in_reports}}, {"_id": 0, "id": 1, "operator_name": 1}
        ).to_list(500)
        job_op_map = {j["id"]: j.get("operator_name", "") for j in jobs_for_ops}

    for r in shift_reports_today:
        produced = r.get("produced_koli", 0)
        if produced <= 0:
            continue
        jid = r.get("job_id")
        op = job_op_map.get(jid, "") if jid else ""
        if op:
            if op not in op_today:
                op_today[op] = {"jobs": 0, "koli": 0}
            op_today[op]["koli"] += produced

    operator_ranking = [{"name": k, "jobs": v["jobs"], "koli": v["koli"]}
                        for k, v in sorted(op_today.items(), key=lambda x: x[1]["koli"], reverse=True)]

    # 7 gunluk gunluk veri: tamamlanan + kismi uretim
    daily_data = {}
    completed_7d_ids = {j["id"] for j in completed_7d}
    prior_partials_7d_by_date = {}
    for r in shift_reports_7d:
        jid = r.get("job_id")
        if jid and jid in completed_7d_ids:
            d = r.get("created_at", "")[:10]
            key = (jid, d)
            prior_partials_7d_by_date[key] = prior_partials_7d_by_date.get(key, 0) + r.get("produced_koli", 0)

    for j in completed_7d:
        date = j.get("completed_at", "")[:10]
        if date:
            completed_koli = j.get("completed_koli", j.get("koli_count", 0))
            # Aynı gun icindeki onceki kismi uretimleri cikar (o uretimler shift report uzerinden eklenecek)
            same_day_prior = sum(
                v for (jid, d), v in prior_partials_7d_by_date.items()
                if jid == j["id"] and d == date
            )
            credit = max(0, completed_koli - same_day_prior)
            daily_data[date] = daily_data.get(date, 0) + credit

    for r in shift_reports_7d:
        produced = r.get("produced_koli", 0)
        if produced <= 0:
            continue
        date = r.get("created_at", "")[:10]
        if date:
            daily_data[date] = daily_data.get(date, 0) + produced

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
