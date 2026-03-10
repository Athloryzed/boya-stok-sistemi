# Buse Kagit - Fabrika Yonetim Sistemi PRD

## Problem Statement
Bir kagit fabrikasi icin tam kapsamli yonetim sistemi. Yoneticiler, operatorler ve planlama ekibi icin ayri arayuzler ile is takibi, vardiya yonetimi ve bildirim sistemi.

## Core Requirements
1. **Android APK & Live Data:** Canli backend'e baglanan Android APK
2. **Automatic APK Updates:** Web guncellemeleri APK icinde otomatik yansimali
3. **Firebase Push Notifications:** Uygulama kapaliyken bile calisan bildirimler
4. **Persistent Manager Login:** Yoneticiler icin 1 gunluk oturum suresi
5. **Job Image Previews:** Plan ekraninda is gorsellerinin onizlemesi (Base64 - MongoDB'de kalici)
6. **Advanced Shift-End Workflow:** Gelismis vardiya sonu rapor akisi
7. **Duplicate Job Warning:** Ayni isimli is eklenirken uyari

## Technical Architecture
- **Backend:** FastAPI, Motor (MongoDB async), WebSockets
- **Frontend:** React, TailwindCSS, Shadcn/UI, Capacitor
- **Database:** MongoDB
- **3rd Party:** Twilio (SMS), Firebase Cloud Messaging (Push Notifications)
- **CI/CD:** GitHub Actions (APK build)
- **Image Storage:** Base64 in MongoDB (persistent)

## User Roles
1. **Yonetim (Management):** Tam yetki, vardiya baslatma/bitirme
2. **Operator (Operator):** Is baslatma/bitirme, rapor gonderme
3. **Plan (Planning):** Is olusturma, takip

## What's Implemented
- [x] GitHub Actions CI/CD for APK
- [x] Production APK Configuration
- [x] Persistent Manager Session (1-day JWT)
- [x] Firebase Push Notifications (Capacitor for Android)
- [x] Advanced Shift-End Workflow
- [x] Job Image Thumbnails (Base64 - persistent)
- [x] Git Secrets Cleanup
- [x] Scrollable dialogs for mobile
- [x] Job pause/resume fix (UI update)
- [x] Duplicate job name warning
- [x] Shift end report - all machines shown (2026-03-02)
- [x] Performance optimizations - separated primary/secondary polling (2026-03-10)
- [x] WebSocket path fix (/api/ws/ prefix for Kubernetes routing) (2026-03-10)
- [x] Consolidated duplicate pallets endpoint (2026-03-10)
- [x] Management intervention buttons (Complete/Edit/Pause on machine cards) (2026-03-10)
- [x] Job age display, notes, format on machine cards (2026-03-10)

## Fixed Issues (2026-03-10)
- [x] P0: Core job management regression (start/complete/edit) - Backend was working, frontend routing confirmed OK
- [x] P0: Warehouse pallet endpoint - Duplicate POST /pallets endpoints consolidated
- [x] P1: WebSocket 403 errors - Paths fixed from /ws/ to /api/ws/ prefix
- [x] P2: Management intervention - Added Complete/Edit buttons directly on machine cards
- [x] P1: Performance - Reduced ManagementFlow polling from 20 API calls/30s to 4 calls/30s + 16 calls/120s

## Pending Issues
1. **P2:** ManagementFlow has large monolithic components that should be broken down
2. **P3:** React hooks dependency warnings in OperatorFlow, PlanFlow

## Upcoming Tasks
- [ ] Shipment & Driver Module (P2)
- [ ] Daily Analytics Drill-Down (P2)

## Future Tasks (Backlog)
- [ ] QR/Barcode Scanning (P3)
- [ ] Frontend component refactoring (break down monolithic *Flow.js files)

## Key Files
- `/app/backend/server.py` - Main backend with FCM, image upload (Base64), WebSocket (/api/ws/)
- `/app/frontend/src/pages/ManagementFlow.js` - Manager UI with machine cards, analytics tabs
- `/app/frontend/src/pages/OperatorFlow.js` - Operator UI
- `/app/frontend/src/pages/PlanFlow.js` - Planning UI
- `/app/frontend/src/pages/WarehouseFlow.js` - Warehouse/Depo UI
- `/app/frontend/src/pushNotifications.js` - Capacitor push notifications

## Database Schema
- `jobs`: { status, pause_reason, image_url (Base64), created_at, queued_at, notes, format, ... }
- `users`: { fcm_tokens: [string], login_time, platform, ... }
- `pallets`: { id, pallet_code/code, job_id, job_name, operator_name, scanned_at, ... }

## Test Credentials
- Management: password `buse11993` (at /management)
- Operator: `ali` / `134679` (at /operator)
- Plan: `emrecan` / `testtest12` (at /plan)
- Warehouse: `depo1` (at /warehouse, password unknown)

## Key API Endpoints
- GET /api/jobs, GET /api/machines, GET /api/shifts/current, GET /api/shifts/status
- PUT /api/jobs/{id}/start, PUT /api/jobs/{id}/complete, PUT /api/jobs/{id}
- POST /api/pallets (accepts both PalletScan and Pallet formats)
- WebSocket: /api/ws/manager/{id}, /api/ws/operator/{machine_id}, /api/ws/warehouse
