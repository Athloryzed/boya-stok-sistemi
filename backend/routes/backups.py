"""
Yedekleme Servisi — Günlük otomatik MongoDB dump.
- /app/backups/ dizinine `mongodump --gzip --archive` formatında yazıyor.
- Son 7 günü saklıyor, eski dosyaları siliyor.
- Sadece Yönetim rolü endpoint'lere erişebiliyor (liste + indirme + manuel tetikleme).
"""
import os
import logging
import subprocess
from pathlib import Path
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import FileResponse
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from auth import get_current_user
from database import db

logger = logging.getLogger(__name__)

BACKUP_DIR = Path("/app/backups")
BACKUP_DIR.mkdir(parents=True, exist_ok=True)
RETENTION_DAYS = 7

router = APIRouter(dependencies=[Depends(get_current_user)])
_scheduler: Optional[AsyncIOScheduler] = None


def _require_yonetim(user: dict):
    roles = user.get("roles") or []
    role = user.get("role")
    # "yonetim" multi-role kullanıcılar + management ana paneli
    if role in ("yonetim", "management") or "yonetim" in roles or "management" in roles:
        return
    raise HTTPException(status_code=403, detail="Sadece Yönetim erişebilir")


def _mongo_uri() -> str:
    uri = os.environ.get("MONGO_URL")
    if not uri:
        raise RuntimeError("MONGO_URL ayarlı değil")
    return uri


def _db_name() -> str:
    return os.environ.get("DB_NAME", "")


def run_backup_sync() -> dict:
    """Senkron yedekleme — schedule + manual tetikleme tarafından kullanılır."""
    ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    filename = f"backup_{ts}.archive.gz"
    out_path = BACKUP_DIR / filename
    uri = _mongo_uri()
    dbn = _db_name()
    cmd = ["mongodump", f"--uri={uri}"]
    if dbn:
        cmd.append(f"--db={dbn}")
    cmd += ["--gzip", f"--archive={out_path}"]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
        if result.returncode != 0:
            logger.error(f"mongodump failed: {result.stderr}")
            return {"success": False, "error": result.stderr[:500]}
    except subprocess.TimeoutExpired:
        return {"success": False, "error": "Yedekleme zaman aşımına uğradı (>5dk)"}
    except Exception as e:
        logger.exception("Backup failed")
        return {"success": False, "error": str(e)}

    size_mb = round(out_path.stat().st_size / 1024 / 1024, 2) if out_path.exists() else 0
    _cleanup_old()
    return {"success": True, "filename": filename, "size_mb": size_mb,
            "created_at": datetime.now(timezone.utc).isoformat()}


def _cleanup_old():
    """RETENTION_DAYS gününden eski arşivleri sil."""
    files = sorted(BACKUP_DIR.glob("backup_*.archive.gz"), key=lambda p: p.stat().st_mtime, reverse=True)
    for old in files[RETENTION_DAYS:]:
        try:
            old.unlink()
            logger.info(f"Silindi: {old.name}")
        except Exception as e:
            logger.warning(f"Silinemedi {old}: {e}")


def start_scheduler():
    """Backend başlangıcında çağrılır — her gece 03:00 UTC'de yedekleme."""
    global _scheduler
    if _scheduler is not None:
        return
    _scheduler = AsyncIOScheduler(timezone="UTC")
    _scheduler.add_job(
        run_backup_sync,
        CronTrigger(hour=3, minute=0),
        id="nightly_backup",
        replace_existing=True,
        misfire_grace_time=3600,
    )
    _scheduler.start()
    logger.info("Backup scheduler başlatıldı (her gün 03:00 UTC)")


@router.get("/admin/backups")
async def list_backups(current_user: dict = Depends(get_current_user)):
    _require_yonetim(current_user)
    files = []
    for p in sorted(BACKUP_DIR.glob("backup_*.archive.gz"), key=lambda p: p.stat().st_mtime, reverse=True):
        st = p.stat()
        files.append({
            "filename": p.name,
            "size_mb": round(st.st_size / 1024 / 1024, 2),
            "created_at": datetime.fromtimestamp(st.st_mtime, tz=timezone.utc).isoformat(),
        })
    next_run = None
    if _scheduler:
        job = _scheduler.get_job("nightly_backup")
        if job and job.next_run_time:
            next_run = job.next_run_time.isoformat()
    return {
        "backups": files,
        "retention_days": RETENTION_DAYS,
        "next_run_utc": next_run,
        "backup_dir": str(BACKUP_DIR),
    }


@router.post("/admin/backups/run")
async def trigger_backup(current_user: dict = Depends(get_current_user)):
    _require_yonetim(current_user)
    result = run_backup_sync()
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result.get("error", "Yedekleme başarısız"))
    return result


@router.get("/admin/backups/download/{filename}")
async def download_backup(filename: str, current_user: dict = Depends(get_current_user)):
    _require_yonetim(current_user)
    # Güvenlik: path traversal önleme
    if "/" in filename or ".." in filename or not filename.startswith("backup_"):
        raise HTTPException(status_code=400, detail="Geçersiz dosya adı")
    path = BACKUP_DIR / filename
    if not path.exists():
        raise HTTPException(status_code=404, detail="Yedek bulunamadı")
    return FileResponse(path, filename=filename, media_type="application/gzip")


@router.delete("/admin/backups/{filename}")
async def delete_backup(filename: str, current_user: dict = Depends(get_current_user)):
    _require_yonetim(current_user)
    if "/" in filename or ".." in filename or not filename.startswith("backup_"):
        raise HTTPException(status_code=400, detail="Geçersiz dosya adı")
    path = BACKUP_DIR / filename
    if not path.exists():
        raise HTTPException(status_code=404, detail="Yedek bulunamadı")
    path.unlink()
    return {"success": True}
