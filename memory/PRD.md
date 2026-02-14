# Buse Kagit - Fabrika Yönetim Sistemi PRD

## Problem Statement
Bir kağıt fabrikası için tam kapsamlı yönetim sistemi. Yöneticiler, operatörler ve planlama ekibi için ayrı arayüzler ile iş takibi, vardiya yönetimi ve bildirim sistemi.

## Core Requirements
1. **Android APK & Live Data:** Canlı backend'e bağlanan Android APK
2. **Automatic APK Updates:** Web güncellemeleri APK içinde otomatik yansımalı
3. **Firebase Push Notifications:** Uygulama kapalıyken bile çalışan bildirimler
4. **Persistent Manager Login:** Yöneticiler için 1 günlük oturum süresi
5. **Job Image Previews:** Plan ekranında iş görsellerinin önizlemesi
6. **Advanced Shift-End Workflow:** Gelişmiş vardiya sonu rapor akışı

## Technical Architecture
- **Backend:** FastAPI, Motor (MongoDB async), WebSockets
- **Frontend:** React, TailwindCSS, Shadcn/UI, Capacitor
- **Database:** MongoDB
- **3rd Party:** Twilio (SMS), Firebase Cloud Messaging (Push Notifications)
- **CI/CD:** GitHub Actions (APK build)

## User Roles
1. **Yönetim (Management):** Tam yetki, vardiya başlatma/bitirme
2. **Operatör (Operator):** İş başlatma/bitirme, rapor gönderme
3. **Plan (Planning):** İş oluşturma, takip

## What's Implemented ✅
- [x] GitHub Actions CI/CD for APK (2026-02-14)
- [x] Production APK Configuration (2026-02-14)
- [x] Persistent Manager Session (1-day JWT) (2026-02-14)
- [x] Firebase Push Notifications (2026-02-14)
- [x] Advanced Shift-End Workflow (2026-02-14)
- [x] Job Image Thumbnails on Plan Screen (2026-02-14)
- [x] Git Secrets Cleanup (firebase-service-account.json removed from history) (2026-02-15)

## Pending Issues 🔴
1. **P0:** End-to-end testing for Firebase notifications
2. **P1:** "White Screen" bug verification on iPhone
3. **P2:** Management Intervention Bug (managers blocked from editing operator-started jobs)
4. **P2:** Nested component lint error in ManagementFlow.js

## Upcoming Tasks 🟡
- [ ] Full E2E Testing with testing_agent
- [ ] User verification after deployment

## Future Tasks (Backlog) 🔵
- [ ] Shipment & Driver Module
- [ ] Daily Analytics Drill-Down (per-machine breakdown)
- [ ] QR/Barcode Scanning

## Key Files
- `/app/backend/server.py` - Main backend with FCM logic
- `/app/frontend/src/pages/ManagementFlow.js` - Manager UI
- `/app/frontend/src/pages/OperatorFlow.js` - Operator UI with shift-end reports
- `/app/frontend/src/pages/PlanFlow.js` - Planning UI with image thumbnails
- `/app/.github/workflows/build-android.yml` - APK build workflow

## Database Schema
- `jobs`: { status, pause_reason, ... }
- `users`: { fcm_tokens: [string], ... }
- `shifts`: { start_time, end_time, ... }

## API Endpoints
- `POST /api/fcm-token` - Register FCM token
- `POST /api/shifts/start` - Start shift (sends notification)
- `POST /api/shifts/end/notify-operators` - Notify operators for shift end

## Test Credentials
- Management: `yonetim` / `buse11993`
- Operator: `ali` / `134679`

## GitHub Secrets Required
- `FIREBASE_SERVICE_ACCOUNT_KEY` - Firebase Admin SDK credentials
- `GOOGLE_SERVICES_JSON` - Android Firebase config (optional, has fallback)
- `BACKEND_URL` - Production backend URL (optional, defaults to busemgmt.emergent.host)
