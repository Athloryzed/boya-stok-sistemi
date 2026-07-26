"""
Panel bazlı AI Asistanı — her panel kendi verisiyle konuşur.

- Model: services/ai_config (varsayılan Claude Opus 4.8, .env AI_MODEL ile değişir)
- Sohbet geçmişi: kullanıcı + panel bazlı KALICI (`ai_panel_messages` koleksiyonu)
- Yetki: SALT OKUNUR — AI hiçbir veri değiştirmez, yalnızca öneri/özet verir
"""
from fastapi import APIRouter, HTTPException, Body, Depends
from datetime import datetime, timezone, timedelta
import logging
import uuid

from database import db
from auth import get_current_user
from emergentintegrations.llm.chat import UserMessage
from services.ai_config import build_chat, get_llm_key, get_ai_model

router = APIRouter(dependencies=[Depends(get_current_user)])
logger = logging.getLogger(__name__)

HISTORY_LIMIT = 12  # LLM'e taşınan son mesaj sayısı (kullanıcı+asistan)

PANEL_ROLES = {
    "plan": ["yonetim", "plan"],
    "boyaci": ["yonetim", "boyaci"],
    "depo": ["yonetim", "plan", "depo"],
    "bobin": ["yonetim", "plan", "depo"],
    "marka_stok": ["yonetim", "plan", "depo"],
    "sofor": ["yonetim", "plan", "sofor"],
    "paint": ["yonetim", "plan", "depo", "boyaci"],
    "operator": ["yonetim", "operator"],
    "yonetim": ["yonetim"],
}

PANEL_TITLES = {
    "plan": "Planlama", "boyaci": "Boyacı", "depo": "Depo", "bobin": "Bobin",
    "marka_stok": "Marka/Koli Stok", "sofor": "Sevkiyat", "paint": "Boya",
    "operator": "Operatör", "yonetim": "Yönetim",
}

BASE_SYSTEM = """Sen Buse Kağıt fabrikasının üretim asistanısın. Türkçe, kısa ve net konuş.
Emoji kullanma. Sadece verilen fabrika verilerine dayanarak cevap ver; veri yoksa "veri yok" de, uydurma.
Cevapları madde işaretleriyle ve en fazla 6 madde ile ver.
Sen SALT OKUNUR bir asistansın: iş başlatamaz, silemez, veri değiştiremezsin. Kullanıcı böyle bir şey isterse
ilgili paneldeki butonu kullanmasını söyle."""


async def _authorized(user: dict, panel: str) -> bool:
    allowed = PANEL_ROLES.get(panel)
    if allowed is None:
        return False
    roles = []
    username = user.get("username")
    if username:
        doc = await db.users.find_one({"username": username}, {"_id": 0, "roles": 1, "role": 1})
        if doc:
            roles = doc.get("roles") or ([doc.get("role")] if doc.get("role") else [])
    if not roles and user.get("role"):
        roles = [user["role"]]
    return "yonetim" in roles or any(r in allowed for r in roles)


def _days(iso):
    if not iso:
        return None
    try:
        return max(0, (datetime.now(timezone.utc) - datetime.fromisoformat(iso.replace("Z", "+00:00"))).days)
    except Exception:
        return None


async def _jobs_context(limit_pending: int = 12) -> str:
    machines = await db.machines.find({}, {"_id": 0, "id": 1, "name": 1, "status": 1, "maintenance": 1}).to_list(50)
    jobs = await db.jobs.find(
        {"status": {"$in": ["pending", "in_progress", "paused"]}},
        {"_id": 0, "image_url": 0},
    ).to_list(500)

    active = [j for j in jobs if j.get("status") in ("in_progress", "paused")]
    pending = sorted([j for j in jobs if j.get("status") == "pending"], key=lambda j: j.get("order") or 0)
    remaining = sum(max(0, (j.get("koli_count") or 0) - (j.get("completed_koli") or 0)) for j in jobs)

    m_lines = []
    for m in machines:
        cur = next((j for j in active if j.get("machine_id") == m["id"]), None)
        pend_n = sum(1 for j in pending if j.get("machine_id") == m["id"])
        m_lines.append(
            f"- {m['name']}: {'BAKIMDA' if m.get('maintenance') else (m.get('status') or 'idle')}"
            + (f" | Aktif is: {cur['name']} ({cur.get('completed_koli', 0)}/{cur.get('koli_count', 0)} koli, operator: {cur.get('operator_name') or '-'})" if cur else " | Aktif is yok")
            + f" | Kuyrukta {pend_n} is"
        )

    p_lines = []
    for i, j in enumerate(pending[:limit_pending], start=1):
        p_lines.append(
            f"{i}. {j.get('name')} | {j.get('machine_name') or '-'} | {j.get('koli_count', 0)} koli"
            f" | olcu: {j.get('format') or '-'} | renk: {j.get('colors') or '-'}"
            f" | musteri: {j.get('customer_name') or '-'} | {_days(j.get('created_at'))} gundur bekliyor"
            + (f" | not: {j.get('notes')}" if j.get("notes") else "")
        )

    return (
        f"Makineler ({len(machines)}):\n" + ("\n".join(m_lines) or "yok")
        + f"\n\nAktif isler: {len(active)} | Bekleyen isler: {len(pending)} | Kalan uretilecek koli: {remaining}"
        + f"\n\nSiradaki isler (order sirasi, ilk {limit_pending}):\n" + ("\n".join(p_lines) or "yok")
    )


async def _paint_context() -> str:
    paints = await db.paints.find({}, {"_id": 0}).to_list(200)
    low = [p for p in paints if (p.get("stock_liters") or 0) < 5]
    lines = [f"- {p.get('color')}: {round(p.get('stock_liters') or 0, 1)} L" for p in sorted(paints, key=lambda x: x.get("stock_liters") or 0)[:15]]
    return f"Boya stoklari ({len(paints)} renk, dusuk stok: {len(low)}):\n" + ("\n".join(lines) or "yok")


async def _bobin_context() -> str:
    bobins = await db.bobins.find({}, {"_id": 0}).to_list(300)
    total_kg = sum(b.get("total_weight_kg") or 0 for b in bobins)
    critical = [b for b in bobins if (b.get("total_weight_kg") or 0) < 50]
    lines = [
        f"- {b.get('brand')} {b.get('width_cm')}cm {b.get('grammage')}gr {b.get('color')}"
        f" | {round(b.get('total_weight_kg') or 0, 1)} kg | depo: {b.get('warehouse') or 'Atanmamis'}"
        for b in sorted(bobins, key=lambda x: x.get("total_weight_kg") or 0)[:15]
    ]
    movements = await db.bobin_movements.find({}, {"_id": 0}).sort("created_at", -1).to_list(10)
    mv = [f"- {m.get('movement_type')}: {m.get('bobin_label') or m.get('brand') or ''} {m.get('weight_kg') or 0} kg ({m.get('target') or m.get('machine_name') or m.get('customer_name') or '-'})" for m in movements]
    return (
        f"Bobin stoklari: {len(bobins)} cesit, toplam {round(total_kg, 1)} kg, kritik (<50kg): {len(critical)}\n"
        + ("\n".join(lines) or "yok")
        + "\n\nSon hareketler:\n" + ("\n".join(mv) or "yok")
    )


async def _marka_stok_context() -> str:
    stocks = await db.brand_stock.find({}, {"_id": 0}).to_list(300)
    low = [s for s in stocks if (s.get("quantity") or 0) < 10]
    lines = [
        f"- {s.get('brand')} {s.get('machine') or ''} {s.get('color') or ''}: {s.get('quantity') or 0} adet | depo: {s.get('warehouse') or 'Atanmamis'}"
        for s in sorted(stocks, key=lambda x: x.get("quantity") or 0)[:15]
    ]
    return f"Marka/koli stok: {len(stocks)} kayit, dusuk stok (<10): {len(low)}\n" + ("\n".join(lines) or "yok")


async def _depo_context() -> str:
    reqs = await db.warehouse_requests.find({}, {"_id": 0}).sort("created_at", -1).to_list(30)
    pending = [r for r in reqs if r.get("status") != "completed"]
    lines = [
        f"- {r.get('request_type') or 'talep'} | {r.get('machine_name') or '-'} | {r.get('operator_name') or '-'}"
        f" | {r.get('quantity') or ''} {r.get('color') or ''} | durum: {r.get('status')}"
        for r in pending[:12]
    ]
    paint = await _paint_context()
    return f"Bekleyen depo talepleri: {len(pending)}\n" + ("\n".join(lines) or "yok") + "\n\n" + paint


async def _sofor_context() -> str:
    shipments = await db.shipments.find({}, {"_id": 0}).sort("created_at", -1).to_list(30)
    active = [s for s in shipments if s.get("status") not in ("delivered", "cancelled")]
    lines = [
        f"- {s.get('customer_name') or '-'} | {s.get('delivery_address') or '-'} | {s.get('total_koli') or 0} koli"
        f" | surucu: {s.get('driver_name') or '-'} | durum: {s.get('status')}"
        for s in active[:12]
    ]
    return f"Aktif sevkiyatlar: {len(active)} / toplam {len(shipments)}\n" + ("\n".join(lines) or "yok")


async def _build_context(panel: str) -> str:
    if panel in ("plan", "yonetim", "operator", "boyaci"):
        ctx = await _jobs_context()
        if panel in ("plan", "yonetim"):
            ctx += "\n\n" + await _paint_context()
        if panel == "boyaci":
            ctx += "\n\n" + await _paint_context()
        return ctx
    if panel == "paint":
        return await _paint_context()
    if panel == "bobin":
        return await _bobin_context()
    if panel == "marka_stok":
        return await _marka_stok_context()
    if panel == "depo":
        return await _depo_context() + "\n\n" + await _jobs_context(limit_pending=6)
    if panel == "sofor":
        return await _sofor_context()
    return ""


@router.get("/ai/panel-info")
async def panel_info():
    provider, model = get_ai_model()
    return {"provider": provider, "model": model, "configured": bool(get_llm_key())}


@router.get("/ai/panel-history")
async def panel_history(panel: str, limit: int = 50, current_user: dict = Depends(get_current_user)):
    if not await _authorized(current_user, panel):
        raise HTTPException(status_code=403, detail="Bu panel asistanına erişim yetkiniz yok")
    key = {"user_id": current_user.get("sub") or current_user.get("username"), "panel": panel}
    msgs = await db.ai_panel_messages.find(key, {"_id": 0}).sort("created_at", 1).to_list(limit)
    return {"messages": msgs, "panel": panel}


@router.delete("/ai/panel-history")
async def clear_panel_history(panel: str, current_user: dict = Depends(get_current_user)):
    if not await _authorized(current_user, panel):
        raise HTTPException(status_code=403, detail="Bu panel asistanına erişim yetkiniz yok")
    uid = current_user.get("sub") or current_user.get("username")
    res = await db.ai_panel_messages.delete_many({"user_id": uid, "panel": panel})
    return {"ok": True, "deleted": res.deleted_count}


@router.post("/ai/panel-chat")
async def panel_chat(data: dict = Body(...), current_user: dict = Depends(get_current_user)):
    panel = (data.get("panel") or "").strip()
    message = (data.get("message") or "").strip()
    if panel not in PANEL_ROLES:
        raise HTTPException(status_code=400, detail="Geçersiz panel")
    if not message:
        raise HTTPException(status_code=400, detail="Mesaj boş olamaz")
    if not await _authorized(current_user, panel):
        raise HTTPException(status_code=403, detail="Bu panel asistanına erişim yetkiniz yok")
    if not get_llm_key():
        raise HTTPException(status_code=500, detail="AI servisi yapılandırılmamış")

    uid = current_user.get("sub") or current_user.get("username")
    key = {"user_id": uid, "panel": panel}

    history = await db.ai_panel_messages.find(key, {"_id": 0}).sort("created_at", -1).to_list(HISTORY_LIMIT)
    history.reverse()

    context = await _build_context(panel)
    system_msg = (
        BASE_SYSTEM
        + f"\n\nSu anda {PANEL_TITLES.get(panel, panel)} panelindeki bir kullanıcıyla konuşuyorsun."
        + f"\n\nGÜNCEL FABRİKA VERİSİ:\n{context}"
    )

    session_id = f"panel_{panel}_{uid}"
    try:
        chat = build_chat(session_id=session_id, system_message=system_msg)
        # Kalıcı geçmişi modele taşı (kısa özet olarak)
        if history:
            transcript = "\n".join(
                f"{'Kullanici' if h.get('role') == 'user' else 'Asistan'}: {h.get('content', '')[:400]}"
                for h in history
            )
            await chat.send_message(UserMessage(
                text=f"[ONCEKI KONUSMA GECMISI — sadece baglam icin, cevap verme]\n{transcript}"
            ))
        response = await chat.send_message(UserMessage(text=message))
    except Exception as e:
        logger.error(f"panel-chat error ({panel}): {e}")
        raise HTTPException(status_code=500, detail=f"AI servisi hatası: {str(e)}")

    now = datetime.now(timezone.utc).isoformat()
    await db.ai_panel_messages.insert_many([
        {**key, "id": str(uuid.uuid4()), "role": "user", "content": message, "created_at": now},
        {**key, "id": str(uuid.uuid4()), "role": "assistant", "content": response, "created_at": now},
    ])

    provider, model = get_ai_model()
    return {"reply": response, "panel": panel, "model": model, "provider": provider, "session_id": session_id}
