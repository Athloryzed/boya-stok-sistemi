# Buse Kagit - Fabrika Yonetim Sistemi PRD

## Problem Statement
Bir kagit fabrikasi icin tam kapsamli yonetim sistemi. Yoneticiler, operatorler ve planlama ekibi icin ayri arayuzler ile is takibi, vardiya yonetimi ve bildirim sistemi.

## Technical Architecture
- **Backend:** FastAPI, Motor (MongoDB async), WebSockets (/api/ws/)
- **Frontend:** React, TailwindCSS, Shadcn/UI, Capacitor, Framer Motion, Recharts
- **Database:** MongoDB
- **3rd Party:** Twilio (SMS), Firebase Cloud Messaging (Push Notifications)
- **PWA:** Service Worker v3 with network-first for HTML/JS, stale-while-revalidate for images
- **Custom Domain:** bksistem.space

## What's Implemented
- [x] GitHub Actions CI/CD for APK (signed release)
- [x] Firebase Push Notifications (Capacitor for Android)
- [x] 24h Persistent Sessions (ALL panels)
- [x] Job Image Thumbnails (Base64)
- [x] Advanced Shift-End Workflow
- [x] Error Boundary (recovery UI + cache clear button)
- [x] Retry mechanism (3 retries with exponential backoff)
- [x] Audit Log System (Management panel "Loglar" tab)
- [x] Management intervention buttons
- [x] Dialog centering fix
- [x] Cross-platform responsive
- [x] PWA support with Service Worker v3
- [x] UI animations (Framer Motion)
- [x] Operator job reorder fix
- [x] Optimistic UI updates
- [x] Swipe-to-dismiss toast notifications
- [x] Spring Theme for Home page
- [x] Ataturk portrait + Waving Turkish flag on Home page
- [x] "Hatirla Beni" (Remember Me) for Operator and Plan login
- [x] **Daily Analytics Drill-Down** - Click day bars for detailed breakdown
- [x] **Haftalik Excel Raporu** - 4-sheet comprehensive report (Ozet, Makine, Operator, Defo)

## Key API Endpoints
- `GET /api/analytics/daily-detail?date=YYYY-MM-DD` - Daily drill-down
- `GET /api/analytics/export?period=weekly&week_offset=N` - Excel report (4 sheets)
- `GET /api/analytics/daily-by-week?week_offset=N` - Weekly daily chart
- `GET /api/analytics/weekly` - Weekly machine stats
- `GET /api/analytics/monthly?year=N&month=N` - Monthly machine stats
- `GET /api/audit-logs` - Audit log entries
- `PUT /api/jobs/reorder-batch` - Must be above /jobs/{job_id} in router

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
