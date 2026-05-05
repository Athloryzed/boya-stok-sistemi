"""
CGNAT/Proxy-aware rate limit yardımcıları.

Kubernetes ve Cloudflare gibi proxy katmanlarının ardındayken
slowapi'nin varsayılan get_remote_address fonksiyonu
proxy IP'sini döndürür ve TÜM kullanıcılar aynı bucket'a düşer.
Bu, mobil CGNAT ağlarda gerçek bir kullanıcının login isteğini
diğerlerinin tükettiği bucket nedeniyle 429'a düşürür.

Çözüm: X-Forwarded-For / X-Real-IP header'larını okuyarak
asıl client IP'sini al.
"""
from fastapi import Request
from slowapi.util import get_remote_address


def get_real_client_ip(request: Request) -> str:
    """Proxy/Cloudflare arkasından gerçek client IP'sini al."""
    # CF-Connecting-IP (Cloudflare)
    cf_ip = request.headers.get("CF-Connecting-IP")
    if cf_ip:
        return cf_ip.strip()

    # X-Forwarded-For (chain: client, proxy1, proxy2, ...)
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()

    # X-Real-IP
    real_ip = request.headers.get("X-Real-IP")
    if real_ip:
        return real_ip.strip()

    # Fallback
    return get_remote_address(request)
