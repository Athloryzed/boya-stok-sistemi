"""
Kamera erişimi.

- POST /api/camera/session: normal (header tabanlı) girişle çağrılır; yonetim/plan
  rolü varsa kısa ömürlü, HttpOnly bir kamera çerezi set eder.
- GET /api/camera/authorize: nginx auth_request tarafından her kamera isteğinde
  çağrılır. iframe ile yüklenen stream istekleri Authorization header taşıyamadığı
  için burada Authorization yerine yukarıdaki çerez doğrulanır. Sık çağrılacağı
  için hafif tutulur; rol sorgusunun DB maliyeti get_user_roles'a bırakılır.
"""
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from auth import (
    get_current_user,
    get_user_roles,
    is_yonetim,
    create_camera_token,
    decode_camera_token,
    CAMERA_COOKIE_NAME,
    CAMERA_COOKIE_MINUTES,
    CAMERA_COOKIE_SECURE,
)

router = APIRouter()


def _camera_allowed(roles: list) -> bool:
    return is_yonetim(roles) or "plan" in (roles or [])


@router.post("/camera/session")
async def create_camera_session(response: Response, current_user: dict = Depends(get_current_user)):
    roles = await get_user_roles(current_user)
    if not _camera_allowed(roles):
        raise HTTPException(status_code=403, detail="Kamera erişimi için yetkiniz yok")

    token = create_camera_token(
        current_user.get("sub", ""),
        current_user.get("username", ""),
        current_user.get("role", ""),
        current_user.get("display_name", ""),
    )
    response.set_cookie(
        key=CAMERA_COOKIE_NAME,
        value=token,
        max_age=CAMERA_COOKIE_MINUTES * 60,
        httponly=True,
        secure=CAMERA_COOKIE_SECURE,
        samesite="strict",
        path="/",
    )
    return {"success": True, "expires_in": CAMERA_COOKIE_MINUTES * 60}


@router.get("/camera/authorize")
async def authorize_camera(request: Request):
    token = request.cookies.get(CAMERA_COOKIE_NAME)
    if not token:
        raise HTTPException(status_code=401, detail="Kamera oturumu yok")

    payload = decode_camera_token(token)
    roles = await get_user_roles(payload)
    if not _camera_allowed(roles):
        raise HTTPException(status_code=403, detail="Kamera erişimi için yetkiniz yok")

    return Response(status_code=200)
