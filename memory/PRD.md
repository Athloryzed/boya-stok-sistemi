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
- [x] Audit Log System with real user names
- [x] Optimistic UI, Swipe-to-dismiss toasts
- [x] Spring Theme, Ataturk portrait, Turkish flag
- [x] "Hatirla Beni" for Operator and Plan login
- [x] Daily Analytics Drill-Down
- [x] Haftalik Excel Raporu (4-sheet)
- [x] AI Operator Assistant (GPT-5.2)
- [x] AI Management Assistant (GPT-5.2)
- [x] **AI Paint Forecast** - Boya tuketim tahmini ve stok uyarisi
- [x] **Live Dashboard (TV)** - Sifresiz canli uretim panosu (/dashboard)
- [x] **Hizli Is Aktarma (Quick Transfer)** - Plan ekranindan bekleyen/durdurulmus isleri baska makinelere aktarma, koli takibi ile (2026-04-09)
- [x] **Is Aktarma Zaman Cizelgesi (Timeline)** - Islerin hangi makinelerden gectigini gosteren gecmis kaydı (2026-04-09)
- [x] **Vardiya Koli Takibi** - Vardiya sonunda girilen koli birikimli olarak takip edilir, kalan koli herkes tarafindan gorunur (2026-04-09)
- [x] **Otomatik Devam (Auto-Resume)** - Vardiya baslatildiginda tamamlanmamis isler otomatik olarak devam eder (2026-04-09)
- [x] **Drag & Drop Is Siralama** - Plan ekraninda surukle-birak ile is sirasi degistirme (2026-04-10)
- [x] **Musteri Siparis Takip** - /takip/:token uzerinden guvenli UUID link ile siparis durumu gosterimi, arama kutusu yok, sadece link ile erisim (2026-04-10)
- [x] **QR Kod Sistemi** - Is kartlarinda QR kod olusturma, yazdir ve operatorde QR tarama ile hizli is baslatma (2026-04-10)

## Key API Endpoints
- `POST /api/jobs/{job_id}/quick-transfer` - Hizli is aktarma (plan ekrani)
- `GET /api/takip/{tracking_token}` - Musteri siparis takip (guvenli UUID link)
- `PUT /api/jobs/reorder-batch` - Toplu is siralama (drag & drop)
- `GET /api/dashboard/live` - Live production dashboard (no auth)
- `GET /api/ai/paint-forecast` - AI paint consumption forecast
- `GET /api/ai/operator-suggestion` - AI operator suggestions
- `POST /api/ai/operator-chat` - Operator AI chat
- `GET /api/ai/management-overview` - Factory AI analysis
- `POST /api/ai/management-chat` - Management AI chat
- `GET /api/analytics/daily-detail` - Daily drill-down
- `GET /api/analytics/export` - Excel report (4 sheets)

## Routes
- `/` - Home (Spring Theme)
- `/management` - Yonetim paneli
- `/operator` - Operator paneli
- `/plan` - Planlama paneli
- `/warehouse` - Depo paneli
- `/paint` - Boya paneli
- `/driver` - Surucu paneli
- `/dashboard` - Canli Uretim Panosu (TV, sifresiz)

## Upcoming Tasks
- [ ] Shipment & Driver Module (P2)

## Future Tasks (Backlog)
- [ ] QR/Barcode Scanning (P3)
- [ ] Frontend component refactoring (P3)
- [ ] Renk gecis optimizasyonu (P3)
- [ ] Makine bakim planlayici (P3)
- [ ] Musteri siparis takip paneli (P3)

## Test Credentials
- Management: password `buse11993` (at /management)
- Operator: `ali` / `134679` (at /operator)
- Plan: `emrecan` / `testtest12` (at /plan)
- Warehouse: `depo1` / `depo123` (at /warehouse)
- Paint: password `buse11993` (at /paint)
- Dashboard: no auth (at /dashboard)
