# Buse Kagit - Fabrika Yonetim Sistemi PRD

## Problem Statement
Bir kagit fabrikasi icin tam kapsamli yonetim sistemi. Yoneticiler, operatorler ve planlama ekibi icin ayri arayuzler ile is takibi, vardiya yonetimi ve bildirim sistemi.

## Technical Architecture
- **Backend:** FastAPI, Motor (MongoDB async), WebSockets (/api/ws/)
- **Frontend:** React, TailwindCSS, Shadcn/UI, Capacitor
- **Database:** MongoDB
- **3rd Party:** Twilio (SMS), Firebase Cloud Messaging (Push Notifications)
- **PWA:** Service Worker with stale-while-revalidate caching

## What's Implemented
- [x] GitHub Actions CI/CD for APK (signed release)
- [x] Firebase Push Notifications (Capacitor for Android)
- [x] 24h Persistent Sessions (ALL panels: Management, Operator, Plan, Paint, Warehouse)
- [x] Job Image Thumbnails (Base64 - persistent in MongoDB)
- [x] Advanced Shift-End Workflow
- [x] Error Boundary (catches React crashes, shows recovery UI instead of black screen)
- [x] Retry mechanism (3 retries with exponential backoff for all data fetching)
- [x] Audit Log System (who did what, when - visible in Management panel "Loglar" tab)
- [x] WebSocket path fix (/api/ws/ prefix)
- [x] Consolidated pallets endpoint
- [x] Management intervention buttons (Complete/Edit/Pause on machine cards)
- [x] Dialog centering fix (CSS animation conflict resolved)
- [x] Cross-platform responsive (Samsung S24, iPad, iPhone, macOS)
- [x] PWA support with Service Worker
- [x] UI animations (staggered cards, button effects, theme transitions)
- [x] Operator job reorder fix (route ordering)
- [x] Performance optimization (separated primary/secondary polling)

## Audit Log Coverage
- Job: create, update, delete, start, complete, pause, resume
- Shift: start
- User: create
- Pallet: create/scan

## Pending/Known Issues
- VPN required for some networks (Emergent infra/DNS level - cannot fix from app code)

## Upcoming Tasks
- [ ] Shipment & Driver Module (P2)
- [ ] Daily Analytics Drill-Down (P2)

## Future Tasks (Backlog)
- [ ] QR/Barcode Scanning (P3)
- [ ] Frontend component refactoring

## Test Credentials
- Management: password `buse11993` (at /management)
- Operator: `ali` / `134679` (at /operator)
- Plan: `emrecan` / `testtest12` (at /plan)
- Warehouse: `depo1` / `depo123` (at /warehouse)
