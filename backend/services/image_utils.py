"""
İş görsel thumbnail üretimi — base64 data URL string al, 128x128 kare küçük
JPEG (quality 70) thumb üret. Liste yanıtlarında 3-8 KB başına maliyetle her iş için
küçük önizleme servis edebiliyoruz.

`create_thumb_data_url(image_url)`:
- Girdi data URL veya http(s) URL olabilir; sadece data URL'leri içerden işler.
- Hata olursa None döner (sessizce).
"""
import base64
import io
import logging
from typing import Optional

from PIL import Image, ImageOps

logger = logging.getLogger(__name__)

THUMB_SIZE = (128, 128)
JPEG_QUALITY = 70


def create_thumb_data_url(image_url: Optional[str]) -> Optional[str]:
    if not image_url or not isinstance(image_url, str):
        return None
    if not image_url.startswith("data:"):
        # http(s) URL: yine de küçültmüyoruz; frontend doğrudan kullansın
        return None
    try:
        head, _, b64 = image_url.partition(",")
        if not b64:
            return None
        raw = base64.b64decode(b64)
        with Image.open(io.BytesIO(raw)) as img:
            # EXIF'e göre döndür (telefon fotoğraflarında lazım)
            img = ImageOps.exif_transpose(img)
            img = img.convert("RGB")
            img.thumbnail(THUMB_SIZE, Image.LANCZOS)
            out = io.BytesIO()
            img.save(out, format="JPEG", quality=JPEG_QUALITY, optimize=True)
            data = out.getvalue()
        b64_out = base64.b64encode(data).decode("ascii")
        return f"data:image/jpeg;base64,{b64_out}"
    except Exception as e:
        logger.warning("Thumbnail oluşturma hatası: %s", e)
        return None
