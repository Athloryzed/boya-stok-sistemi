"""
Idempotency Middleware — POST/PUT/PATCH/DELETE çift-submit koruması.

Akış:
1. Frontend axios interceptor her POST/PUT/PATCH/DELETE'e benzersiz `Idempotency-Key`
   header ekler (UUID v4).
2. Backend bu header varsa MongoDB cache'inde arar:
   - Tamamlanmış varsa → cached response'u 200/orijinal status ile döndür
   - "processing" durumunda → 429 (zaten çalışıyor)
   - Yoksa → execute, response'u cache'le
3. Header yoksa normal akış (geriye dönük tam uyumlu).

TTL: 1 saat (idempotency_keys koleksiyonunda `created_at` index'i ile otomatik silinir).

Bu mekanizma çift-tıklamayı, ağ retry'larını, browser refresh sırasında
yapılan kayıt requestlerini güvence altına alır.
"""
import json
import logging
from datetime import datetime, timezone

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

from database import db

logger = logging.getLogger(__name__)

PROTECTED_METHODS = ("POST", "PUT", "PATCH", "DELETE")
SKIP_PATHS = ("/api/auth/", "/api/management/login", "/api/users/login",
              "/api/dashboard/login", "/api/visitors/log",
              "/api/notifications/register-token", "/api/upload/")


class IdempotencyMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        # Sadece mutasyon metodları için
        if request.method not in PROTECTED_METHODS:
            return await call_next(request)

        path = request.url.path
        # Auth/login/upload gibi endpoint'leri atla (idempotency anlamlı değil veya bozucu)
        if any(path.startswith(p) for p in SKIP_PATHS):
            return await call_next(request)

        key = request.headers.get("idempotency-key") or request.headers.get("Idempotency-Key")
        if not key or len(key) < 8 or len(key) > 128:
            return await call_next(request)

        try:
            cached = await db.idempotency_keys.find_one({"_id": key}, {"_id": 1, "status": 1, "body": 1, "status_code": 1, "media_type": 1})
        except Exception as e:
            logger.warning(f"Idempotency cache lookup failed: {e}")
            return await call_next(request)

        if cached:
            if cached.get("status") == "completed":
                # Tekrar geldi — cached response'u döndür
                body = (cached.get("body") or "").encode("utf-8")
                return Response(
                    content=body,
                    status_code=int(cached.get("status_code", 200)),
                    media_type=cached.get("media_type") or "application/json",
                    headers={"X-Idempotent-Replay": "true"},
                )
            # processing — paralel istek
            return Response(
                content=json.dumps({"detail": "İşlem zaten devam ediyor, lütfen bekleyin."}, ensure_ascii=False).encode("utf-8"),
                status_code=429,
                media_type="application/json",
                headers={"X-Idempotent-Replay": "processing"},
            )

        # Yeni anahtar → "processing" kaydı oluştur
        try:
            await db.idempotency_keys.insert_one({
                "_id": key,
                "status": "processing",
                "method": request.method,
                "path": path,
                "created_at": datetime.now(timezone.utc),
            })
        except Exception:
            # Race: başka worker tam anda kaydetmiş olabilir → tekrar oku
            try:
                cached = await db.idempotency_keys.find_one({"_id": key}, {"_id": 1, "status": 1, "body": 1, "status_code": 1, "media_type": 1})
                if cached and cached.get("status") == "completed":
                    body = (cached.get("body") or "").encode("utf-8")
                    return Response(
                        content=body,
                        status_code=int(cached.get("status_code", 200)),
                        media_type=cached.get("media_type") or "application/json",
                        headers={"X-Idempotent-Replay": "race"},
                    )
            except Exception:
                pass
            return Response(
                content=json.dumps({"detail": "İşlem zaten devam ediyor."}, ensure_ascii=False).encode("utf-8"),
                status_code=429,
                media_type="application/json",
            )

        # Asıl işlemi çalıştır
        response = await call_next(request)

        # Response gövdesini topla (streaming response'ları da destekler)
        body_chunks = []
        async for chunk in response.body_iterator:
            body_chunks.append(chunk)
        body = b"".join(body_chunks)

        # Cache'e yaz (sadece başarılı veya kullanıcı-hatası response'lar; 5xx tekrar denenebilsin)
        try:
            if response.status_code < 500:
                # body decode — bazı durumlarda binary gelebilir
                try:
                    body_str = body.decode("utf-8")
                except UnicodeDecodeError:
                    body_str = ""
                await db.idempotency_keys.update_one(
                    {"_id": key},
                    {"$set": {
                        "status": "completed",
                        "body": body_str,
                        "status_code": response.status_code,
                        "media_type": response.media_type or "application/json",
                        "completed_at": datetime.now(timezone.utc),
                    }}
                )
            else:
                # 5xx → cache'i sil ki retry mümkün olsun
                await db.idempotency_keys.delete_one({"_id": key})
        except Exception as e:
            logger.warning(f"Idempotency cache write failed: {e}")

        return Response(
            content=body,
            status_code=response.status_code,
            headers=dict(response.headers),
            media_type=response.media_type,
        )
