from fastapi import APIRouter, HTTPException, Body, Depends
from typing import Optional
from datetime import datetime, timezone
import logging

from database import db
from models import Shift, ShiftEndOperatorReport, ShiftEndReport, DefectLog
from services.audit import log_audit
from services.notifications import (
    send_notification_to_operators, send_notification_to_all_workers,
    send_whatsapp_notification
)
from websocket_manager import ws_manager
from auth import get_current_user

router = APIRouter(dependencies=[Depends(get_current_user)])


@router.post("/shifts/request-end")
async def request_shift_end():
    """Vardiya sonu bildirimi gönder - tüm aktif operatörlere"""
    active_shift = await db.shifts.find_one({"status": "active"}, {"_id": 0}, sort=[("started_at", -1)])
    if not active_shift:
        raise HTTPException(status_code=400, detail="Aktif vardiya bulunamadı")

    await db.shifts.update_one(
        {"id": active_shift["id"]},
        {"$set": {"status": "pending_reports", "pending_approval": True}}
    )

    active_jobs = await db.jobs.find({"status": "in_progress"}, {"_id": 0}).to_list(100)

    notifications_sent = []
    for job in active_jobs:
        effective_target = job.get("remaining_koli") if job.get("remaining_koli", 0) > 0 else job["koli_count"]
        notification = {
            "type": "shift_end_request",
            "shift_id": active_shift["id"],
            "job_id": job["id"], "job_name": job["name"],
            "machine_id": job["machine_id"], "machine_name": job["machine_name"],
            "target_koli": effective_target, "original_koli": job["koli_count"],
            "operator_name": job.get("operator_name", ""),
            "message": "Vardiya bitti! Lütfen işinizi tamamlayın veya üretim bilgilerinizi girin."
        }
        notifications_sent.append(notification)
        await ws_manager.broadcast({"type": "shift_end_request", "data": notification})

    return {
        "message": "Vardiya sonu bildirimi gönderildi",
        "shift_id": active_shift["id"],
        "notifications_sent": len(notifications_sent),
        "active_jobs": notifications_sent
    }


@router.post("/shifts/operator-report")
async def submit_operator_report(data: dict = Body(...)):
    """Operatörün vardiya sonu raporu"""
    report = ShiftEndOperatorReport(
        shift_id=data.get("shift_id"),
        operator_id=data.get("operator_id", ""),
        operator_name=data.get("operator_name", ""),
        machine_id=data.get("machine_id"),
        machine_name=data.get("machine_name", ""),
        job_id=data.get("job_id"),
        job_name=data.get("job_name", ""),
        target_koli=data.get("target_koli", 0),
        produced_koli=data.get("produced_koli", 0),
        defect_kg=float(data.get("defect_kg", 0)),
        is_completed=data.get("is_completed", False),
        status="pending"
    )

    await db.shift_operator_reports.insert_one(report.model_dump())

    await ws_manager.broadcast({
        "type": "new_operator_report",
        "data": {
            "report_id": report.id,
            "operator_name": data.get("operator_name", ""),
            "machine_name": data.get("machine_name", ""),
            "job_name": data.get("job_name", "")
        }
    })

    return {"message": "Rapor gönderildi, onay bekleniyor", "report_id": report.id}


@router.get("/shifts/pending-reports")
async def get_pending_reports():
    """Onay bekleyen operatör raporlarını listele"""
    reports = await db.shift_operator_reports.find(
        {"status": "pending"}, {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    return reports


@router.post("/shifts/approve-report/{report_id}")
async def approve_operator_report(report_id: str, data: dict = Body(None)):
    """Operatör raporunu onayla"""
    approved_by = data.get("approved_by", "Yönetim") if data else "Yönetim"

    report = await db.shift_operator_reports.find_one({"id": report_id}, {"_id": 0})
    if not report:
        raise HTTPException(status_code=404, detail="Rapor bulunamadı")

    await db.shift_operator_reports.update_one(
        {"id": report_id},
        {"$set": {
            "status": "approved",
            "approved_at": datetime.now(timezone.utc).isoformat(),
            "approved_by": approved_by
        }}
    )

    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    if report.get("is_completed"):
        job_id = report.get("job_id")
        if job_id:
            job = await db.jobs.find_one({"id": job_id}, {"_id": 0})
            if job:
                completed_koli = report.get("target_koli", job.get("koli_count", 0))
                await db.jobs.update_one(
                    {"id": job_id},
                    {"$set": {
                        "status": "completed",
                        "completed_at": datetime.now(timezone.utc).isoformat(),
                        "completed_koli": completed_koli
                    }}
                )
                await db.machines.update_one(
                    {"id": report["machine_id"]},
                    {"$set": {"status": "idle", "current_job_id": None}}
                )
                try:
                    message = f"Is Tamamlandi!\n\nIs: {job['name']}\nMakine: {job['machine_name']}\nKoli: {completed_koli}\nOperator: {report.get('operator_name', '-')}"
                    await send_whatsapp_notification(message)
                except Exception as e:
                    logging.error(f"WhatsApp error: {e}")
    else:
        shift_report = ShiftEndReport(
            shift_id=report["shift_id"],
            machine_id=report["machine_id"],
            machine_name=report["machine_name"],
            job_id=report.get("job_id"),
            job_name=report.get("job_name"),
            target_koli=report.get("target_koli", 0),
            produced_koli=report.get("produced_koli", 0),
            remaining_koli=report.get("target_koli", 0) - report.get("produced_koli", 0),
            defect_kg=report.get("defect_kg", 0)
        )
        await db.shift_end_reports.insert_one(shift_report.model_dump())

        if report.get("job_id"):
            job = await db.jobs.find_one({"id": report["job_id"]}, {"_id": 0})
            if job:
                prev_completed = job.get("completed_koli", 0)
                new_produced = report.get("produced_koli", 0)
                total_completed = prev_completed + new_produced
                original_koli = job.get("koli_count", 0)
                remaining = original_koli - total_completed
                await db.jobs.update_one(
                    {"id": report["job_id"]},
                    {"$set": {
                        "remaining_koli": remaining if remaining > 0 else 0,
                        "completed_koli": total_completed,
                        "status": "pending"
                    }}
                )

        if report.get("defect_kg", 0) > 0:
            defect_log = DefectLog(
                machine_id=report["machine_id"],
                machine_name=report["machine_name"],
                shift_id=report["shift_id"],
                defect_kg=report["defect_kg"],
                date=today
            )
            await db.defect_logs.insert_one(defect_log.model_dump())

        await db.machines.update_one(
            {"id": report["machine_id"]},
            {"$set": {"status": "idle", "current_job_id": None}}
        )

    return {"message": "Rapor onaylandı"}


@router.post("/shifts/approve-all")
async def approve_all_reports_and_end_shift():
    """Tüm raporları onayla ve vardiyayı bitir"""
    pending_reports = await db.shift_operator_reports.find(
        {"status": "pending"}, {"_id": 0}
    ).to_list(100)

    for report in pending_reports:
        await approve_operator_report(report["id"], {"approved_by": "Yönetim (Toplu)"})

    active_shift = await db.shifts.find_one({"status": "pending_reports"}, {"_id": 0}, sort=[("started_at", -1)])
    if active_shift:
        await db.shifts.update_one(
            {"id": active_shift["id"]},
            {"$set": {
                "status": "ended",
                "ended_at": datetime.now(timezone.utc).isoformat(),
                "pending_approval": False
            }}
        )

    return {"message": f"{len(pending_reports)} rapor onaylandı ve vardiya bitirildi"}


@router.get("/shifts/status")
async def get_shift_status():
    """Mevcut vardiya durumunu getir - en son vardiyayi dondur"""
    shift = await db.shifts.find_one(
        {"status": {"$in": ["active", "pending_reports"]}}, {"_id": 0},
        sort=[("started_at", -1)]
    )
    if not shift:
        return {"status": "no_active_shift", "shift": None}

    pending_count = await db.shift_operator_reports.count_documents({"status": "pending", "shift_id": shift["id"]})

    return {
        "status": shift["status"],
        "shift": shift,
        "pending_reports_count": pending_count
    }


@router.post("/shifts/end-with-report")
async def end_shift_with_report(data: dict = Body(...)):
    """Vardiya bitişinde makine bazlı üretim ve defo raporu"""
    machine_reports = data.get("reports", [])

    active_shift = await db.shifts.find_one({"status": "active"}, {"_id": 0}, sort=[("started_at", -1)])
    if not active_shift:
        raise HTTPException(status_code=400, detail="Aktif vardiya bulunamadı")

    shift_id = active_shift["id"]
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    for report in machine_reports:
        machine_id = report.get("machine_id")
        machine_name = report.get("machine_name", "")
        job_id = report.get("job_id")
        job_name = report.get("job_name", "")
        target_koli = report.get("target_koli", 0)
        produced_koli = report.get("produced_koli", 0)
        defect_kg = float(report.get("defect_kg", 0))
        remaining_koli = target_koli - produced_koli

        shift_report = ShiftEndReport(
            shift_id=shift_id, machine_id=machine_id, machine_name=machine_name,
            job_id=job_id, job_name=job_name, target_koli=target_koli,
            produced_koli=produced_koli,
            remaining_koli=remaining_koli if remaining_koli > 0 else 0,
            defect_kg=defect_kg
        )
        await db.shift_end_reports.insert_one(shift_report.model_dump())

        if job_id and remaining_koli > 0:
            await db.jobs.update_one(
                {"id": job_id},
                {"$set": {"remaining_koli": remaining_koli, "completed_koli": produced_koli}}
            )

        if defect_kg > 0:
            defect_log = DefectLog(
                machine_id=machine_id, machine_name=machine_name,
                shift_id=shift_id, defect_kg=defect_kg, date=today
            )
            await db.defect_logs.insert_one(defect_log.model_dump())

        await db.machines.update_one(
            {"id": machine_id},
            {"$set": {"status": "idle", "current_job_id": None}}
        )

    await db.shifts.update_one(
        {"id": shift_id},
        {"$set": {"status": "ended", "ended_at": datetime.now(timezone.utc).isoformat()}}
    )

    return {"message": "Vardiya raporu kaydedildi ve vardiya bitirildi"}


@router.post("/shifts/start")
async def start_shift(started_by: str = None):
    active_shift = await db.shifts.find_one({"status": "active"}, {"_id": 0}, sort=[("started_at", -1)])
    if active_shift:
        raise HTTPException(status_code=400, detail="There is already an active shift")

    shift = Shift()
    await db.shifts.insert_one(shift.model_dump())

    partial_jobs = await db.jobs.find(
        {"status": "pending", "completed_koli": {"$gt": 0}, "remaining_koli": {"$gt": 0}},
        {"_id": 0}
    ).to_list(100)

    resumed_count = 0
    for job in partial_jobs:
        await db.jobs.update_one(
            {"id": job["id"]},
            {"$set": {"status": "in_progress", "started_at": datetime.now(timezone.utc).isoformat()}}
        )
        await db.machines.update_one(
            {"id": job["machine_id"]},
            {"$set": {"status": "working", "current_job_id": job["id"]}}
        )
        resumed_count += 1

    try:
        await send_notification_to_all_workers(
            title="Vardiya Basladi!",
            body=f"Gunluk vardiya baslamistir. {resumed_count} is otomatik devam etti." if resumed_count > 0 else "Gunluk vardiya baslamistir. Iyi calismalar!",
            data={"type": "shift_started", "shift_id": shift.id}
        )
    except Exception as e:
        logging.error(f"Shift start notification error: {e}")

    await log_audit(started_by or "Yonetim", "create", "shift", shift.id,
                    f"Vardiya baslatildi. {resumed_count} is otomatik devam etti." if resumed_count > 0 else "Vardiya baslatildi")

    return {"id": shift.id, "started_at": shift.started_at, "status": shift.status, "resumed_jobs": resumed_count}


@router.post("/shifts/end")
async def end_shift():
    active_shift = await db.shifts.find_one({"status": "active"}, {"_id": 0}, sort=[("started_at", -1)])
    if not active_shift:
        raise HTTPException(status_code=400, detail="No active shift found")

    await db.shifts.update_one(
        {"id": active_shift["id"]},
        {"$set": {"status": "ended", "ended_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"message": "Shift ended"}


@router.post("/shifts/notify-end")
async def notify_shift_end():
    """Vardiya bitiş bildirimi gönder"""
    active_shift = await db.shifts.find_one({"status": "active"}, {"_id": 0}, sort=[("started_at", -1)])
    if not active_shift:
        raise HTTPException(status_code=400, detail="Aktif vardiya bulunamadı")

    active_jobs = await db.jobs.find(
        {"status": {"$in": ["in_progress", "paused"]}}, {"_id": 0}
    ).to_list(100)

    try:
        await send_notification_to_operators(
            machine_id="all",
            title="Vardiya Bitti!",
            body="Lütfen üretim ve defo bilgilerinizi girin.",
            data={"type": "shift_end_report", "shift_id": active_shift["id"]}
        )
    except Exception as e:
        logging.error(f"Shift end notification error: {e}")

    return {
        "message": "Operatörlere bildirim gönderildi",
        "active_jobs": active_jobs,
        "shift_id": active_shift["id"]
    }


@router.get("/shifts/current")
async def get_current_shift():
    shift = await db.shifts.find_one({"status": "active"}, {"_id": 0}, sort=[("started_at", -1)])
    return shift


@router.post("/shifts/cleanup-stuck")
async def cleanup_stuck_shifts():
    """Takili kalmis pending_reports vardiyalarini temizle (admin)"""
    now = datetime.now(timezone.utc).isoformat()
    result = await db.shifts.update_many(
        {"status": "pending_reports"},
        {"$set": {"status": "ended", "ended_at": now, "pending_approval": False}}
    )
    cleaned = result.modified_count

    if cleaned > 0:
        await db.shift_operator_reports.update_many(
            {"status": "pending"},
            {"$set": {"status": "expired", "approved_at": now, "approved_by": "Sistem (Temizlik)"}}
        )

    return {"message": f"{cleaned} takili vardiya temizlendi", "cleaned": cleaned}


@router.get("/shift-reports")
async def get_shift_reports(shift_id: Optional[str] = None, limit: int = 50):
    """Vardiya sonu raporlarını listele"""
    query = {}
    if shift_id:
        query["shift_id"] = shift_id
    reports = await db.shift_end_reports.find(query, {"_id": 0}).sort("created_at", -1).to_list(limit)
    return reports
