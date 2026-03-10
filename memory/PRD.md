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
- **Backend:** FastAPI, Motor (MongoDB async), WebSockets (/api/ws/)
- **Frontend:** React, TailwindCSS, Shadcn/UI, Capacitor
- **Database:** MongoDB
- **3rd Party:** Twilio (SMS), Firebase Cloud Messaging (Push Notifications)
- **CI/CD:** GitHub Actions (APK build)
- **Image Storage:** Base64 in MongoDB (persistent)
- **PWA:** Service Worker with stale-while-revalidate caching

## User Roles
1. **Yonetim (Management):** Tam yetki, vardiya baslatma/bitirme
2. **Operator (Operator):** Is baslatma/bitirme, rapor gonderme
3. **Plan (Planning):** Is olusturma, takip
4. **Depo (Warehouse):** Palet tarama, sevkiyat

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
- [x] Shift end report - all machines shown
- [x] Performance optimizations - separated primary/secondary polling
- [x] WebSocket path fix (/api/ws/ prefix for Kubernetes routing)
- [x] Consolidated duplicate pallets endpoint
- [x] Management intervention buttons (Complete/Edit/Pause on machine cards)
- [x] Job age display, notes, format on machine cards

### Fixed Issues (2026-03-10)
- [x] P0: Core job management regression (start/complete/edit)
- [x] P0: Warehouse pallet endpoint - duplicate endpoints consolidated
- [x] P1: WebSocket 403 errors - paths fixed from /ws/ to /api/ws/
- [x] P2: Management intervention - Added Complete/Edit buttons on machine cards
- [x] P1: Performance - Reduced polling from 20 calls/30s to 4 calls/30s + 16 calls/120s
- [x] P0: Dialog centering bug - CSS animation conflicting with transform centering
- [x] PWA support with Service Worker
- [x] UI animations (staggered cards, button effects, theme transitions)
- [x] Cross-platform responsive optimization (Samsung S24, iPad, iPhone, macOS)
- [x] Dialog scrollability (max-h-[90vh] overflow-y-auto)
- [x] Touch targets minimum 44px on mobile
- [x] Tab horizontal scrolling on mobile
- [x] Warehouse login verified (depo1/depo123)

## Pending Issues
None critical.

## Upcoming Tasks
- [ ] Shipment & Driver Module (P2)
- [ ] Daily Analytics Drill-Down (P2)

## Future Tasks (Backlog)
- [ ] QR/Barcode Scanning (P3)
- [ ] Frontend component refactoring (break down monolithic *Flow.js files)
- [ ] React hooks dependency warnings cleanup

## Key Files
- `/app/backend/server.py` - Main backend
- `/app/frontend/src/App.css` - Global animations and responsive CSS
- `/app/frontend/src/components/ui/dialog.jsx` - Dialog component (fixed centering)
- `/app/frontend/src/pages/ManagementFlow.js` - Manager UI
- `/app/frontend/src/pages/OperatorFlow.js` - Operator UI
- `/app/frontend/src/pages/PlanFlow.js` - Planning UI
- `/app/frontend/src/pages/WarehouseFlow.js` - Warehouse UI
- `/app/frontend/public/service-worker.js` - PWA service worker
- `/app/frontend/public/manifest.json` - PWA manifest

## Test Credentials
- Management: password `buse11993` (at /management)
- Operator: `ali` / `134679` (at /operator)
- Plan: `emrecan` / `testtest12` (at /plan)
- Warehouse: `depo1` / `depo123` (at /warehouse)
