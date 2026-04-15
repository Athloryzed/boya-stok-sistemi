from fastapi import APIRouter, HTTPException, Body, Depends
from datetime import datetime, timezone, timedelta
import os
import uuid
import logging

from database import db
from models import AIChatRequest, AIManagementChatRequest
from emergentintegrations.llm.chat import LlmChat, UserMessage
from auth import get_current_user

router = APIRouter(dependencies=[Depends(get_current_user)])
logger = logging.getLogger(__name__)


@router.get("/ai/operator-suggestion")
async def get_ai_operator_suggestion(machine_id: str, operator_name: str):
    """Makine ve iş verilerine dayalı AI öneri üretir"""
    llm_key = os.environ.get("EMERGENT_LLM_KEY")
    if not llm_key:
        raise HTTPException(status_code=500, detail="AI servisi yapılandırılmamış")

    machine = await db.machines.find_one({"id": machine_id}, {"_id": 0})
    if not machine:
        raise HTTPException(status_code=404, detail="Makine bulunamadı")

    pending_jobs = await db.jobs.find(
        {"machine_id": machine_id, "status": {"$in": ["pending", "in_progress"]}}, {"_id": 0}
    ).to_list(50)

    week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    recent_completed = await db.jobs.find(
        {"machine_id": machine_id, "status": "completed", "completed_at": {"$gte": week_ago}}, {"_id": 0}
    ).to_list(50)

    recent_defects = await db.defect_logs.find(
        {"machine_id": machine_id, "created_at": {"$gte": week_ago}}, {"_id": 0}
    ).to_list(20)

    recent_shifts = await db.shift_end_reports.find(
        {"machine_id": machine_id, "created_at": {"$gte": week_ago}}, {"_id": 0}
    ).to_list(20)

    avg_duration = None
    avg_koli_per_hour = None
    if recent_completed:
        durations = []
        for job in recent_completed:
            if job.get("started_at") and job.get("completed_at"):
                try:
                    s = datetime.fromisoformat(job["started_at"].replace("Z", "+00:00"))
                    e = datetime.fromisoformat(job["completed_at"].replace("Z", "+00:00"))
                    dur_h = (e - s).total_seconds() / 3600
                    if dur_h > 0:
                        durations.append(dur_h)
                except Exception:
                    pass
        if durations:
            avg_duration = round(sum(durations) / len(durations), 1)
            total_koli = sum(j.get("completed_koli", j.get("koli_count", 0)) for j in recent_completed)
            total_hours = sum(durations)
            avg_koli_per_hour = round(total_koli / total_hours) if total_hours > 0 else 0

    total_defect_kg = sum(d.get("defect_kg", 0) for d in recent_defects)

    jobs_info = []
    for j in pending_jobs:
        jobs_info.append(f"- {j['name']}: {j.get('koli_count', 0)} koli, Renkler: {j.get('colors', 'Belirtilmemiş')}, Format: {j.get('format', 'Belirtilmemiş')}, Durum: {j['status']}, Öncelik: {j.get('priority', 'normal')}")

    context = f"""Makine: {machine['name']}
Operatör: {operator_name}
Bekleyen/Aktif İşler ({len(pending_jobs)} adet):
{chr(10).join(jobs_info) if jobs_info else 'Bekleyen iş yok'}

Son 7 Gün İstatistikleri:
- Tamamlanan iş: {len(recent_completed)}
- Ortalama iş süresi: {avg_duration} saat
- Ortalama üretim hızı: {avg_koli_per_hour} koli/saat
- Toplam defo: {total_defect_kg} kg ({len(recent_defects)} kayıt)
- Vardiya raporu: {len(recent_shifts)} adet"""

    try:
        chat = LlmChat(
            api_key=llm_key,
            session_id=f"suggestion_{machine_id}_{uuid.uuid4().hex[:8]}",
            system_message="""Sen bir fabrika üretim danışmanısın. Kısa ve net öneriler ver.
Türkçe yanıt ver. Emoji kullanma. 
Şu konularda öneri ver:
1. İş sıralama (renk geçişi, öncelik, format uyumu)
2. Verimlilik (hız, kalite, defo azaltma)
3. Uyarılar (bakım ihtiyacı, anormal defo oranı vb.)
Her öneriyi tek cümle ile yaz. Madde işareti kullan. Maksimum 5 öneri ver."""
        ).with_model("openai", "gpt-5.2")

        msg = UserMessage(text=f"Bu makinenin mevcut durumu:\n{context}\n\nBu verilere göre operatöre önerilerin neler?")
        response = await chat.send_message(msg)

        return {
            "suggestions": response,
            "machine_name": machine["name"],
            "stats": {
                "pending_jobs": len(pending_jobs),
                "completed_7d": len(recent_completed),
                "avg_duration_h": avg_duration,
                "avg_koli_per_hour": avg_koli_per_hour,
                "defect_kg_7d": round(total_defect_kg, 2)
            }
        }
    except Exception as e:
        logger.error(f"AI suggestion error: {e}")
        raise HTTPException(status_code=500, detail=f"AI servisi hatası: {str(e)}")


@router.post("/ai/operator-chat")
async def ai_operator_chat(req: AIChatRequest):
    """Operatör ile AI arasında sohbet"""
    llm_key = os.environ.get("EMERGENT_LLM_KEY")
    if not llm_key:
        raise HTTPException(status_code=500, detail="AI servisi yapılandırılmamış")

    machine = await db.machines.find_one({"id": req.machine_id}, {"_id": 0})
    machine_name = machine["name"] if machine else "Bilinmiyor"

    pending_jobs = await db.jobs.find(
        {"machine_id": req.machine_id, "status": {"$in": ["pending", "in_progress"]}}, {"_id": 0}
    ).to_list(50)

    week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    recent_completed = await db.jobs.find(
        {"machine_id": req.machine_id, "status": "completed", "completed_at": {"$gte": week_ago}}, {"_id": 0}
    ).to_list(30)

    recent_defects = await db.defect_logs.find(
        {"machine_id": req.machine_id, "created_at": {"$gte": week_ago}}, {"_id": 0}
    ).to_list(20)

    jobs_text = "\n".join([f"- {j['name']}: {j.get('koli_count',0)} koli, {j.get('colors','')}, Durum: {j['status']}" for j in pending_jobs]) or "Yok"
    completed_text = "\n".join([f"- {j['name']}: {j.get('completed_koli', j.get('koli_count',0))} koli" for j in recent_completed[:10]]) or "Yok"
    defect_text = "\n".join([f"- {d.get('defect_kg',0)} kg ({d.get('notes','')})" for d in recent_defects[:5]]) or "Yok"

    chat_history = await db.ai_chat_history.find(
        {"session_id": req.session_id}, {"_id": 0}
    ).sort("created_at", 1).to_list(20)

    system_msg = f"""Sen Buse Kağıt fabrikasında çalışan bir AI üretim asistanısın.
Makine: {machine_name}
Operatör: {req.operator_name}

Mevcut işler:
{jobs_text}

Son 7 günde tamamlanan (son 10):
{completed_text}

Son defolar:
{defect_text}

Kurallar:
- Türkçe yanıt ver
- Kısa ve pratik cevaplar ver (maks 3-4 cümle)
- Sadece üretim, makine, iş ve fabrikayla ilgili sorulara cevap ver
- Emoji kullanma"""

    try:
        chat = LlmChat(
            api_key=llm_key, session_id=req.session_id,
            system_message=system_msg
        ).with_model("openai", "gpt-5.2")

        for hist in chat_history:
            if hist.get("role") == "user":
                await chat.send_message(UserMessage(text=hist["content"]))

        response = await chat.send_message(UserMessage(text=req.message))

        now = datetime.now(timezone.utc).isoformat()
        await db.ai_chat_history.insert_many([
            {"session_id": req.session_id, "role": "user", "content": req.message, "created_at": now},
            {"session_id": req.session_id, "role": "assistant", "content": response, "created_at": now}
        ])

        return {"response": response, "session_id": req.session_id}
    except Exception as e:
        logger.error(f"AI chat error: {e}")
        raise HTTPException(status_code=500, detail=f"AI servisi hatası: {str(e)}")


@router.get("/ai/management-overview")
async def get_ai_management_overview():
    """Tüm fabrika verilerini analiz edip yönetim önerisi üretir"""
    llm_key = os.environ.get("EMERGENT_LLM_KEY")
    if not llm_key:
        raise HTTPException(status_code=500, detail="AI servisi yapılandırılmamış")

    week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()

    all_machines = await db.machines.find({}, {"_id": 0}).to_list(50)
    active_jobs = await db.jobs.find({"status": {"$in": ["pending", "in_progress"]}}, {"_id": 0}).to_list(200)
    completed_7d = await db.jobs.find({"status": "completed", "completed_at": {"$gte": week_ago}}, {"_id": 0}).to_list(500)
    completed_today = [j for j in completed_7d if j.get("completed_at", "") >= today_start]
    defects_7d = await db.defect_logs.find({"created_at": {"$gte": week_ago}}, {"_id": 0}).to_list(200)

    idle_machines = [m for m in all_machines if m.get("status") == "idle"]
    working_machines = [m for m in all_machines if m.get("status") == "working"]
    maintenance_machines = [m for m in all_machines if m.get("status") == "maintenance"]

    machine_stats = {}
    for job in completed_7d:
        mn = job.get("machine_name", "")
        if mn not in machine_stats:
            machine_stats[mn] = {"jobs": 0, "koli": 0, "durations": []}
        machine_stats[mn]["jobs"] += 1
        machine_stats[mn]["koli"] += job.get("completed_koli", job.get("koli_count", 0))
        if job.get("started_at") and job.get("completed_at"):
            try:
                s = datetime.fromisoformat(job["started_at"].replace("Z", "+00:00"))
                e = datetime.fromisoformat(job["completed_at"].replace("Z", "+00:00"))
                machine_stats[mn]["durations"].append((e - s).total_seconds() / 3600)
            except Exception:
                pass

    op_stats = {}
    for job in completed_7d:
        op = job.get("operator_name", "")
        if not op:
            continue
        if op not in op_stats:
            op_stats[op] = {"jobs": 0, "koli": 0}
        op_stats[op]["jobs"] += 1
        op_stats[op]["koli"] += job.get("completed_koli", job.get("koli_count", 0))

    total_defect_kg = sum(d.get("defect_kg", 0) for d in defects_7d)
    total_koli_7d = sum(j.get("completed_koli", j.get("koli_count", 0)) for j in completed_7d)
    total_koli_today = sum(j.get("completed_koli", j.get("koli_count", 0)) for j in completed_today)

    machine_lines = []
    for m in all_machines:
        jobs_on_machine = [j for j in active_jobs if j.get("machine_id") == m.get("id")]
        stats = machine_stats.get(m["name"], {})
        avg_h = round(sum(stats.get("durations", [])) / len(stats["durations"]), 1) if stats.get("durations") else None
        machine_lines.append(f"- {m['name']}: Durum={m.get('status','?')}, Bekleyen iş={len(jobs_on_machine)}, 7g üretim={stats.get('koli',0)} koli, Ort. süre={avg_h}s")

    op_lines = [f"- {op}: {s['jobs']} iş, {s['koli']} koli" for op, s in sorted(op_stats.items(), key=lambda x: x[1]['koli'], reverse=True)[:10]]

    defect_by_machine = {}
    for d in defects_7d:
        mn = d.get("machine_name", "")
        defect_by_machine[mn] = defect_by_machine.get(mn, 0) + d.get("defect_kg", 0)
    defect_lines = [f"- {mn}: {round(kg,1)} kg" for mn, kg in sorted(defect_by_machine.items(), key=lambda x: x[1], reverse=True)]

    context = f"""FABRIKA GENEL DURUMU
Tarih: {datetime.now(timezone.utc).strftime('%d.%m.%Y %H:%M')}

Makineler ({len(all_machines)} toplam):
- Çalışan: {len(working_machines)}, Boşta: {len(idle_machines)}, Bakımda: {len(maintenance_machines)}
{chr(10).join(machine_lines)}

Üretim (Son 7 Gün):
- Tamamlanan: {len(completed_7d)} iş, {total_koli_7d} koli
- Bugün: {len(completed_today)} iş, {total_koli_today} koli
- Toplam bekleyen: {len(active_jobs)} iş

Operatör Performansı (Son 7 Gün, Top 10):
{chr(10).join(op_lines) if op_lines else 'Veri yok'}

Defo Durumu (Son 7 Gün): {round(total_defect_kg, 1)} kg
{chr(10).join(defect_lines) if defect_lines else 'Defo kaydı yok'}"""

    try:
        chat = LlmChat(
            api_key=llm_key,
            session_id=f"mgmt_overview_{uuid.uuid4().hex[:8]}",
            system_message="""Sen bir fabrika yönetim danışmanısın. Verilen fabrika verilerini analiz et ve yönetime kısa, net öneriler sun.
Türkçe yanıt ver. Emoji kullanma.
Şu başlıklar altında önerilerde bulun:
1. GENEL DURUM (1-2 cümle fabrika özeti)
2. DARBOGAZLAR (varsa sorunlu makine/operatör)
3. VERIMLILIK ONERILERI (iş dağılımı, kapasite kullanımı)
4. UYARILAR (bakım, defo, geciken işler)
Her maddeyi kısa tut. Maksimum 8 madde."""
        ).with_model("openai", "gpt-5.2")

        response = await chat.send_message(UserMessage(text=f"Fabrika durumunu analiz et:\n{context}"))

        return {
            "overview": response,
            "stats": {
                "total_machines": len(all_machines),
                "working": len(working_machines), "idle": len(idle_machines),
                "maintenance": len(maintenance_machines),
                "pending_jobs": len(active_jobs),
                "completed_today": len(completed_today),
                "koli_today": total_koli_today,
                "completed_7d": len(completed_7d),
                "koli_7d": total_koli_7d,
                "defect_kg_7d": round(total_defect_kg, 2),
                "active_operators": len(op_stats)
            }
        }
    except Exception as e:
        logger.error(f"AI management overview error: {e}")
        raise HTTPException(status_code=500, detail=f"AI servisi hatası: {str(e)}")


@router.post("/ai/management-chat")
async def ai_management_chat(req: AIManagementChatRequest):
    """Yönetici ile AI arasında fabrika geneli sohbet"""
    llm_key = os.environ.get("EMERGENT_LLM_KEY")
    if not llm_key:
        raise HTTPException(status_code=500, detail="AI servisi yapılandırılmamış")

    week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()

    all_machines = await db.machines.find({}, {"_id": 0}).to_list(50)
    active_jobs = await db.jobs.find({"status": {"$in": ["pending", "in_progress"]}}, {"_id": 0}).to_list(200)
    completed_7d = await db.jobs.find({"status": "completed", "completed_at": {"$gte": week_ago}}, {"_id": 0}).to_list(500)
    defects_7d = await db.defect_logs.find({"created_at": {"$gte": week_ago}}, {"_id": 0}).to_list(200)

    machines_text = "\n".join([f"- {m['name']}: {m.get('status','?')}" for m in all_machines])
    jobs_text = "\n".join([f"- {j['name']}: {j.get('machine_name','?')}, {j.get('koli_count',0)} koli, {j['status']}" for j in active_jobs[:20]])
    completed_text = "\n".join([f"- {j['name']}: {j.get('machine_name','?')}, {j.get('completed_koli', j.get('koli_count',0))} koli, Operator: {j.get('operator_name','?')}" for j in completed_7d[:15]])

    op_stats = {}
    for j in completed_7d:
        op = j.get("operator_name", "")
        if op:
            if op not in op_stats:
                op_stats[op] = {"jobs": 0, "koli": 0}
            op_stats[op]["jobs"] += 1
            op_stats[op]["koli"] += j.get("completed_koli", j.get("koli_count", 0))
    op_text = "\n".join([f"- {op}: {s['jobs']} iş, {s['koli']} koli" for op, s in sorted(op_stats.items(), key=lambda x: x[1]['koli'], reverse=True)])

    system_msg = f"""Sen Buse Kağıt fabrikasında yönetim danışmanı AI'sın.

Makineler:
{machines_text}

Aktif/Bekleyen İşler:
{jobs_text or 'Yok'}

Son 7 Gün Tamamlanan (son 15):
{completed_text or 'Yok'}

Operatör İstatistikleri (Son 7 Gün):
{op_text or 'Veri yok'}

Toplam Defo: {round(sum(d.get('defect_kg',0) for d in defects_7d), 1)} kg

Kurallar:
- Türkçe yanıt ver
- Kısa ve net cevaplar ver (maks 4-5 cümle)
- Sadece fabrika, üretim, makine, operatör, iş konularında cevap ver
- Emoji kullanma"""

    chat_history = await db.ai_chat_history.find(
        {"session_id": req.session_id}, {"_id": 0}
    ).sort("created_at", 1).to_list(20)

    try:
        chat = LlmChat(
            api_key=llm_key, session_id=req.session_id,
            system_message=system_msg
        ).with_model("openai", "gpt-5.2")

        for hist in chat_history:
            if hist.get("role") == "user":
                await chat.send_message(UserMessage(text=hist["content"]))

        response = await chat.send_message(UserMessage(text=req.message))

        now = datetime.now(timezone.utc).isoformat()
        await db.ai_chat_history.insert_many([
            {"session_id": req.session_id, "role": "user", "content": req.message, "created_at": now},
            {"session_id": req.session_id, "role": "assistant", "content": response, "created_at": now}
        ])

        return {"response": response, "session_id": req.session_id}
    except Exception as e:
        logger.error(f"AI management chat error: {e}")
        raise HTTPException(status_code=500, detail=f"AI servisi hatası: {str(e)}")
