"""
Security Headers Middleware — XSS, clickjacking, MIME sniffing, downgrade saldırılarına karşı koruma.
Tüm HTTP yanıtlarına standart güvenlik header'larını ekler.
"""
from starlette.middleware.base import BaseHTTPMiddleware


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        response = await call_next(request)
        # HSTS: 2 yıl, alt domainlere uygula, preload list'e uygun
        response.headers.setdefault(
            "Strict-Transport-Security",
            "max-age=63072000; includeSubDomains; preload"
        )
        # Clickjacking koruması — iframe'e gömülmeyi engelle
        response.headers.setdefault("X-Frame-Options", "DENY")
        # MIME sniffing engeli
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        # Referrer minimum — sadece origin
        response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        # Permissions Policy — kamera/mikrofon/konum izinleri varsayılan kapalı
        response.headers.setdefault(
            "Permissions-Policy",
            "camera=(self), microphone=(), geolocation=(), payment=()"
        )
        # CSP — XSS koruması (Firebase/Google scripts izinli, inline'a 'unsafe-inline' gerekli — React build)
        response.headers.setdefault(
            "Content-Security-Policy",
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.gstatic.com https://*.firebaseio.com https://*.googleapis.com; "
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net; "
            "font-src 'self' data: https://fonts.gstatic.com https://cdn.jsdelivr.net; "
            "img-src 'self' data: blob: https:; "
            "connect-src 'self' https://*.firebaseio.com https://*.googleapis.com wss: https:; "
            "frame-ancestors 'none'; "
            "base-uri 'self'; "
            "form-action 'self'"
        )
        return response
