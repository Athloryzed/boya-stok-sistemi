# Buse Kagit - Fabrika Yönetim Sistemi PRD

## Problem Statement
Bir kağıt fabrikası için tam kapsamlı yönetim sistemi. Yöneticiler, operatörler ve planlama ekibi için ayrı arayüzler ile iş takibi, vardiya yönetimi ve bildirim sistemi.

## Core Requirements
1. **Android APK & Live Data:** Canlı backend'e bağlanan Android APK
2. **Automatic APK Updates:** Web güncellemeleri APK içinde otomatik yansımalı
3. **Firebase Push Notifications:** Uygulama kapalıyken bile çalışan bildirimler
4. **Persistent Manager Login:** Yöneticiler için 1 günlük oturum süresi
5. **Job Image Previews:** Plan ekranında iş görsellerinin önizlemesi (Base64 - MongoDB'de kalıcı)
6. **Advanced Shift-End Workflow:** Gelişmiş vardiya sonu rapor akışı
7. **Duplicate Job Warning:** Aynı isimli iş eklenirken uyarı

## Technical Architecture
- **Backend:** FastAPI, Motor (MongoDB async), WebSockets
- **Frontend:** React, TailwindCSS, Shadcn/UI, Capacitor
- **Database:** MongoDB
- **3rd Party:** Twilio (SMS), Firebase Cloud Messaging (Push Notifications)
- **CI/CD:** GitHub Actions (APK build)
- **Image Storage:** Base64 in MongoDB (persistent)

## User Roles
1. **Yönetim (Management):** Tam yetki, vardiya başlatma/bitirme
2. **Operatör (Operator):** İş başlatma/bitirme, rapor gönderme
3. **Plan (Planning):** İş oluşturma, takip

## What's Implemented ✅
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

## Pending Issues 🔴
1. **P1:** Site access issues (user-side, cache/network)
2. **P2:** Management Intervention Bug

## Upcoming Tasks 🟡
- [ ] Full E2E Testing with testing_agent
- [ ] User verification after deployment

## Future Tasks (Backlog) 🔵
- [ ] Shipment & Driver Module
- [ ] Daily Analytics Drill-Down
- [ ] QR/Barcode Scanning

## Key Files
- `/app/backend/server.py` - Main backend with FCM, image upload (Base64)
- `/app/frontend/src/pages/ManagementFlow.js` - Manager UI
- `/app/frontend/src/pages/OperatorFlow.js` - Operator UI
- `/app/frontend/src/pages/PlanFlow.js` - Planning UI
- `/app/frontend/src/pushNotifications.js` - Capacitor push notifications

## Database Schema
- `jobs`: { status, pause_reason, image_url (Base64), ... }
- `users`: { fcm_tokens: [string], ... }
- `images`: { id, data (Base64 data URL), ... }

## Test Credentials
- Management: `yonetim` / `buse11993`
- Operator: `ali` / `134679`
- Plan: `emrecan` / `testtest12`
