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
- [x] 24h Persistent Sessions, Error Boundary, Retry mechanism
- [x] Audit Log System, Optimistic UI, Swipe-to-dismiss toasts
- [x] Spring Theme, Ataturk portrait, Turkish flag on Home page
- [x] "Hatirla Beni" (Remember Me) for Operator and Plan login
- [x] Daily Analytics Drill-Down
- [x] Haftalik Excel Raporu (4-sheet)
- [x] **AI Operator Assistant** - GPT-5.2 suggestions + chat (blue/purple)
- [x] **AI Management Assistant** - GPT-5.2 factory analysis + chat (green/teal)

## Key API Endpoints
- `GET /api/ai/operator-suggestion` - AI production suggestions per machine
- `POST /api/ai/operator-chat` - Conversational AI for operators
- `GET /api/ai/management-overview` - Factory-wide AI analysis
- `POST /api/ai/management-chat` - Conversational AI for managers
- `GET /api/analytics/daily-detail` - Daily drill-down
- `GET /api/analytics/export` - Excel report (4 sheets)

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
