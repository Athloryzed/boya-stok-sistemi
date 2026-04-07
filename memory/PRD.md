# Buse Kagit - Fabrika Yonetim Sistemi PRD

## Problem Statement
Bir kagit fabrikasi icin tam kapsamli yonetim sistemi. Yoneticiler, operatorler ve planlama ekibi icin ayri arayuzler ile is takibi, vardiya yonetimi ve bildirim sistemi.

## Technical Architecture
- **Backend:** FastAPI, Motor (MongoDB async), WebSockets (/api/ws/)
- **Frontend:** React, TailwindCSS, Shadcn/UI, Capacitor, Framer Motion, Recharts
- **Database:** MongoDB
- **AI:** GPT-5.2 via Emergent Universal Key (emergentintegrations library)
- **3rd Party:** Twilio (SMS), Firebase Cloud Messaging (Push Notifications)
- **PWA:** Service Worker v3 with network-first for HTML/JS
- **Custom Domain:** bksistem.space

## What's Implemented
- [x] Role-based panels (Management, Operator, Plan, Warehouse, Paint)
- [x] GitHub Actions CI/CD for APK (signed release)
- [x] Firebase Push Notifications (Capacitor for Android)
- [x] 24h Persistent Sessions (ALL panels)
- [x] Error Boundary (recovery UI + cache clear button)
- [x] Retry mechanism (3 retries with exponential backoff)
- [x] Audit Log System (Management "Loglar" tab)
- [x] Optimistic UI updates
- [x] Swipe-to-dismiss toast notifications
- [x] Spring Theme for Home page (dynamic sky, petals, butterflies)
- [x] Ataturk portrait + Waving Turkish flag on Home page
- [x] "Hatirla Beni" (Remember Me) for Operator and Plan login
- [x] Daily Analytics Drill-Down (click day bars for detailed breakdown)
- [x] Haftalik Excel Raporu (4-sheet: Ozet, Makine, Operator, Defo)
- [x] **AI Operator Assistant** - GPT-5.2 powered floating panel with Suggestions + Chat tabs

## Key API Endpoints
- `GET /api/ai/operator-suggestion?machine_id=X&operator_name=Y` - AI production suggestions
- `POST /api/ai/operator-chat` - Conversational AI for operators
- `GET /api/analytics/daily-detail?date=YYYY-MM-DD` - Daily drill-down
- `GET /api/analytics/export?period=weekly&week_offset=N` - Excel report (4 sheets)
- `GET /api/audit-logs` - Audit log entries
- `PUT /api/jobs/reorder-batch` - Must be above /jobs/{job_id} in router

## DB Collections
- jobs, machines, users, audit_logs, shift_end_reports, defect_logs
- ai_chat_history (session_id, role, content, created_at)

## Upcoming Tasks
- [ ] Shipment & Driver Module (P2)

## Future Tasks (Backlog)
- [ ] QR/Barcode Scanning (P3)
- [ ] Frontend component refactoring (P3)

## Test Credentials
- Management: password `buse11993` (at /management)
- Operator: `ali` / `134679` (at /operator)
- Plan: `emrecan` / `testtest12` (at /plan)
- Warehouse: `depo1` / `depo123` (at /warehouse)
