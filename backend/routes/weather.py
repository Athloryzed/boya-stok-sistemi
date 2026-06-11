"""
İstanbul Hava Durumu API (Open-Meteo proxy).

- GET /api/weather/istanbul → anlık hava durumu (auth gerekmez; anasayfa dinamik arka planı için)
- 30 dk bellek içi önbellek (Open-Meteo ücretsiz limiti: ~10.000 çağrı/gün → günde en fazla 48 çağrı)
- Sağlayıcı hatasında en son bilinen veri (stale=True) döner.

Veri kaynağı: Open-Meteo.com (CC BY 4.0)
"""
import time
import logging

import httpx
from fastapi import APIRouter

router = APIRouter()
logger = logging.getLogger(__name__)

_OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"
_LAT, _LON = 41.0082, 28.9784  # İstanbul
_CACHE_TTL_SECONDS = 30 * 60

_cache = {"data": None, "fetched_at": 0.0}


@router.get("/weather/istanbul")
async def get_istanbul_weather():
    """İstanbul anlık hava durumu — herkese açık, 30 dk önbellekli."""
    now = time.time()
    if _cache["data"] and (now - _cache["fetched_at"]) < _CACHE_TTL_SECONDS:
        return _cache["data"]

    params = {
        "latitude": _LAT,
        "longitude": _LON,
        "current": "temperature_2m,weather_code,is_day,wind_speed_10m",
        "timezone": "auto",
    }
    try:
        timeout = httpx.Timeout(10.0, connect=5.0)
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.get(_OPEN_METEO_URL, params=params)
            resp.raise_for_status()
            cur = resp.json().get("current") or {}

        data = {
            "location": "istanbul",
            "temperature_c": cur.get("temperature_2m"),
            "weather_code": cur.get("weather_code"),
            "is_day": bool(cur.get("is_day")),
            "wind_speed_kmh": cur.get("wind_speed_10m"),
            "observed_at": cur.get("time"),
            "stale": False,
        }
        _cache["data"] = data
        _cache["fetched_at"] = now
        return data
    except Exception as e:
        logger.warning(f"Open-Meteo isteği başarısız: {e}")
        if _cache["data"]:
            return {**_cache["data"], "stale": True}
        return {
            "location": "istanbul",
            "temperature_c": None,
            "weather_code": None,
            "is_day": True,
            "wind_speed_kmh": None,
            "observed_at": None,
            "stale": True,
        }
