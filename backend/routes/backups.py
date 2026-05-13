"""
Yedekleme Servisi — Günlük otomatik MongoDB dump.
- /app/backups/ dizinine `mongodump --gzip --archive` formatında yazıyor.
- Son 7 günü saklıyor, eski dosyaları siliyor.
- (Opsiyonel) Google Drive Service Account ile otomatik off-site upload.
- Sadece Yönetim rolü endpoint'lere erişebiliyor.
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

# Google Drive (Service Account)
try:
    from google.oauth2 import service_account
    from googleapiclient.discovery import build
    from googleapiclient.http import MediaFileUpload
    DRIVE_AVAILABLE = True
except Exception:
    DRIVE_AVAILABLE = False

logger = logging.getLogger(__name__)

BACKUP_DIR = Path(os.environ.get("BACKUP_DIR", "/app/backups"))
BACKUP_DIR.mkdir(parents=True, exist_ok=True)
RETENTION_DAYS = int(os.environ.get("BACKUP_RETENTION_DAYS", "30"))

DRIVE_SCOPES = ["https://www.googleapis.com/auth/drive.file"]


def _drive_service():
    """Google Drive servisi (Service Account ile). None döner eğer config yoksa/hatalıysa."""
    if not DRIVE_AVAILABLE:
        return None, None
    creds_path = os.environ.get("GOOGLE_DRIVE_CREDENTIALS_PATH")
    folder_id = os.environ.get("GOOGLE_DRIVE_FOLDER_ID")
    if not creds_path or not folder_id or not os.path.exists(creds_path):
        return None, None
    try:
        creds = service_account.Credentials.from_service_account_file(creds_path, scopes=DRIVE_SCOPES)
        svc = build("drive", "v3", credentials=creds, cache_discovery=False)
        return svc, folder_id
    except Exception as e:
        logger.error(f"Drive servisi kurulamadı: {e}")
        return None, None


def upload_to_drive(local_path: Path) -> dict:
    """Bir dosyayı Drive klasörüne yükle. Sonuç: {success, file_id, web_link, error?}"""
    svc, folder_id = _drive_service()
    if not svc:
        return {"success": False, "error": "Drive yapılandırması yok (env veya credentials.json eksik)"}
    try:
        media = MediaFileUpload(str(local_path), mimetype="application/gzip", resumable=True)
        meta = {"name": local_path.name, "parents": [folder_id]}
        result = svc.files().create(body=meta, media_body=media,
                                    fields="id, name, webViewLink, size, createdTime").execute()
        logger.info(f"Drive'a yüklendi: {result.get('name')} ({result.get('id')})")
        return {
            "success": True, "file_id": result.get("id"),
            "name": result.get("name"), "web_link": result.get("webViewLink"),
            "size": int(result.get("size", 0)),
        }
    except Exception as e:
        logger.exception("Drive upload hatası")
        return {"success": False, "error": str(e)}


router = APIRouter(dependencies=[Depends(get_current_user)])
_scheduler: Optional[AsyncIOScheduler] = None


def _require_yonetim(user: dict):
    roles = user.get("roles") or []
    role = user.get("role")
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


def _python_bson_backup(out_path: Path) -> dict:
    """
    mongodump binary'si yoksa Python fallback. Her collection'ı BSON olarak
    tar.gz içine yazar. Geri yükleme için /admin/backups/restore_python kullanılır
    veya pymongo ile manual restore yapılır.
    """
    import io
    import gzip
    import tarfile
    from pymongo import MongoClient
    from bson import BSON

    uri = _mongo_uri()
    dbn = _db_name()
    client = MongoClient(uri)
    database = client[dbn] if dbn else client.get_default_database()
    if database is None:
        return {"success": False, "error": "Veritabanı adı belirlenemedi"}

    try:
        with gzip.open(out_path, "wb") as gz, tarfile.open(fileobj=gz, mode="w|") as tar:
            for coll_name in database.list_collection_names():
                buf = io.BytesIO()
                for doc in database[coll_name].find({}):
                    buf.write(BSON.encode(doc))
                data = buf.getvalue()
                info = tarfile.TarInfo(name=f"{coll_name}.bson")
                info.size = len(data)
                info.mtime = int(datetime.now(timezone.utc).timestamp())
                tar.addfile(info, io.BytesIO(data))
        return {"success": True}
    except Exception as e:
        logger.exception("Python backup failed")
        return {"success": False, "error": str(e)}
    finally:
        client.close()


def run_backup_sync(upload_drive: bool = True) -> dict:
    """Senkron yedekleme — mongodump varsa onu, yoksa Python fallback'ı kullanır."""
    ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    filename = f"backup_{ts}.archive.gz"
    out_path = BACKUP_DIR / filename
    uri = _mongo_uri()
    dbn = _db_name()
    cmd = ["mongodump", f"--uri={uri}"]
    if dbn:
        cmd.append(f"--db={dbn}")
    cmd += ["--gzip", f"--archive={out_path}"]

    used_fallback = False
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
        if result.returncode != 0:
            logger.error(f"mongodump failed: {result.stderr}")
            return {"success": False, "error": result.stderr[:500]}
    except FileNotFoundError:
        # mongodump binary yok — Python fallback
        logger.warning("mongodump bulunamadı, Python fallback kullanılıyor")
        used_fallback = True
        fb = _python_bson_backup(out_path)
        if not fb["success"]:
            return fb
    except subprocess.TimeoutExpired:
        return {"success": False, "error": "Yedekleme zaman aşımına uğradı (>5dk)"}
    except Exception as e:
        logger.exception("Backup failed")
        return {"success": False, "error": str(e)}

    size_mb = round(out_path.stat().st_size / 1024 / 1024, 2) if out_path.exists() else 0
    _cleanup_old()

    response = {"success": True, "filename": filename, "size_mb": size_mb,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "method": "python_bson" if used_fallback else "mongodump"}

    if upload_drive:
        # Sadece Drive yapılandırması varsa upload denenir
        svc, _ = _drive_service()
        if svc is not None:
            drive_res = upload_to_drive(out_path)
            response["drive"] = drive_res

    return response


def _cleanup_old():
    files = sorted(BACKUP_DIR.glob("backup_*.archive.gz"), key=lambda p: p.stat().st_mtime, reverse=True)
    for old in files[RETENTION_DAYS:]:
        try:
            old.unlink()
            logger.info(f"Silindi: {old.name}")
        except Exception as e:
            logger.warning(f"Silinemedi {old}: {e}")


def start_scheduler():
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

    # Drive durumu
    svc, folder_id = _drive_service()
    drive_status = {
        "enabled": svc is not None,
        "folder_id": folder_id,
        "service_account": None,
    }
    if svc is not None:
        try:
            creds_path = os.environ.get("GOOGLE_DRIVE_CREDENTIALS_PATH")
            import json as _json
            with open(creds_path, "r") as f:
                drive_status["service_account"] = _json.load(f).get("client_email")
        except Exception:
            pass

    return {
        "backups": files,
        "retention_days": RETENTION_DAYS,
        "next_run_utc": next_run,
        "backup_dir": str(BACKUP_DIR),
        "drive": drive_status,
    }


@router.post("/admin/backups/run")
async def trigger_backup(current_user: dict = Depends(get_current_user)):
    _require_yonetim(current_user)
    result = run_backup_sync(upload_drive=True)
    if not result["success"]:
        raise HTTPException(status_code=500, detail=result.get("error", "Yedekleme başarısız"))
    return result


@router.get("/admin/backups/download/{filename}")
async def download_backup(filename: str, current_user: dict = Depends(get_current_user)):
    _require_yonetim(current_user)
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


# ─────────────── Google Drive Endpoints ───────────────

@router.post("/admin/backups/drive/upload/{filename}")
async def manual_drive_upload(filename: str, current_user: dict = Depends(get_current_user)):
    """Var olan lokal yedeği Drive'a yükle."""
    _require_yonetim(current_user)
    if "/" in filename or ".." in filename or not filename.startswith("backup_"):
        raise HTTPException(status_code=400, detail="Geçersiz dosya adı")
    path = BACKUP_DIR / filename
    if not path.exists():
        raise HTTPException(status_code=404, detail="Lokal yedek bulunamadı")
    result = upload_to_drive(path)
    if not result.get("success"):
        raise HTTPException(status_code=500, detail=result.get("error", "Drive yükleme başarısız"))
    return result


@router.get("/admin/backups/drive")
async def list_drive_backups(current_user: dict = Depends(get_current_user)):
    """Google Drive klasöründeki tüm yedekleri listele."""
    _require_yonetim(current_user)
    svc, folder_id = _drive_service()
    if not svc:
        return {"enabled": False, "files": []}
    try:
        q = f"'{folder_id}' in parents and trashed = false"
        results = svc.files().list(
            q=q, fields="files(id, name, size, createdTime, webViewLink)",
            orderBy="createdTime desc", pageSize=100
        ).execute()
        files = []
        for f in results.get("files", []):
            files.append({
                "file_id": f.get("id"),
                "name": f.get("name"),
                "size_mb": round(int(f.get("size", 0)) / 1024 / 1024, 2) if f.get("size") else 0,
                "created_at": f.get("createdTime"),
                "web_link": f.get("webViewLink"),
            })
        return {"enabled": True, "folder_id": folder_id, "files": files}
    except Exception as e:
        logger.exception("Drive listeleme hatası")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/admin/backups/drive/{file_id}")
async def delete_drive_backup(file_id: str, current_user: dict = Depends(get_current_user)):
    _require_yonetim(current_user)
    svc, _ = _drive_service()
    if not svc:
        raise HTTPException(status_code=400, detail="Drive yapılandırması yok")
    try:
        svc.files().delete(fileId=file_id).execute()
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
