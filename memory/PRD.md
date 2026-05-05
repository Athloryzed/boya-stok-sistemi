# Buse Kagit - Uretim Yonetim Sistemi PRD

## Original Problem Statement
Factory management system for Buse Kagit paper company. Full-stack React + FastAPI + MongoDB PWA with AI assistants, Excel exports, live dashboards, QR codes, drag & drop, and secure JWT/bcrypt authentication.

## Architecture (Post-Refactoring & Security Hardening - Feb 2026)

### Backend Structure
```
/app/backend/
├── server.py              # Main app (~160 lines) - FastAPI setup, routers, WebSockets, startup, CORS
├── database.py            # MongoDB connection (client, db)
├── auth.py                # JWT + bcrypt helpers + MANAGEMENT_PASSWORD + DASHBOARD_PASSWORD
├── models.py              # All Pydantic models
├── websocket_manager.py   # ConnectionManager instances (ws_manager, ws_manager_mgmt)
├── services/
│   ├── audit.py           # log_audit function
│   └── notifications.py   # Firebase FCM, Twilio WhatsApp, notification helpers
├── routes/
│   ├── health.py          # Public: /, /health
│   ├── machines.py        # Protected: /machines CRUD, maintenance
│   ├── jobs.py            # Mixed: /takip public, rest protected
│   ├── shifts.py          # Protected (router-level)
│   ├── defects.py         # Protected (router-level)
│   ├── analytics.py       # Protected (router-level) + Excel export
│   ├── users.py           # Mixed: login public, CRUD protected
│   ├── warehouse.py       # Protected (router-level)
│   ├── paints.py          # Protected (router-level) + AI forecast
│   ├── ai.py              # Protected (router-level)
│   ├── dashboard.py       # Mixed: /dashboard/login public, /dashboard/live protected
│   ├── messages.py        # Protected (router-level)
│   ├── visitors.py        # Mixed: /visitors/log public, rest protected
│   ├── operators.py       # Protected (router-level)
│   ├── pallets.py         # Protected (router-level)
│   ├── logistics.py       # Mixed: /drivers/login public, rest protected
│   └── misc.py            # Protected (router-level): audit-logs, FCM, manager registration
```

### Security Model
- **All backend routes** require JWT `Authorization: Bearer <token>` header
- **Public exceptions:** /health, /api/, /users/login, /management/login, /dashboard/login, /drivers/login, /takip/{token}, /visitors/log
- **Passwords:** bcrypt hashed in DB, auto-migrated on startup
- **Dashboard password:** Server-side verification via /api/dashboard/login (removed from frontend JS)
- **Frontend:** Axios interceptor auto-attaches JWT from localStorage

## What's Been Implemented
- All core features (jobs, machines, shifts, paint, warehouse, analytics, AI)
- **Bobin Tracking Module** — QR/Barcode scanning, barcode-based stock lookup, brand/width/grammage/color tracking, machine assignment, customer sales, movement history with user audit, Excel export. Color options: Beyaz/Kraft/Diger(custom). Role-restricted: only depo + plan users. 24h remember-me session.
- Security: JWT auth on ALL endpoints + bcrypt passwords + rate limiting
- Dashboard password moved from client-side to server-side
- Backend refactoring: monolithic server.py → 23+ modular files
- MongoDB Indexes: 46+ custom indexes across all collections
- PWA, WebSocket, Excel export, QR Code, Drag & Drop, Customer tracking

### Feb 2026 (Iteration 29) — Plan B: Mobile/Slow Network Optimization
- **Global axios timeout**: 20s default (App.js) — yavaş ağlarda infinite hang'i önler.
- **ManagementFlow fetchSecondaryData batched**: 17 paralel istek → 5 batch (3-5'erli), her biri 15s timeout. Mobil ağlarda TCP connection limit aşılması ve cascade timeout engellendi.
- **fetchData primary**: 12s timeout, retry max 2x exponential backoff, agresif toast kaldırıldı.
- **WebSocket exponential backoff**: 3s→6s→12s→24s→max 60s, 5 deneme sonrası pes (polling yedek).
- **BobinFlow multi-role fix** (Iter 28): roles[] içinde plan veya depo varsa girebilir.

### Feb 2026 (Iteration 27) — Multi-Role Users + Analytics Bug Fix (TESTED 14/14 ✅)
- **BUG FIX (Critical)**: Vardiya bitirildiğinde `produced_koli` analytics'te kayboluyordu. `analytics.py` daily + daily-by-week + weekly + monthly + daily-detail endpoint'leri: `status != 'completed'` dışlaması kaldırıldı; yeni logic: completed jobs için `completed_koli - prior_partials` = gerçek gün katkısı, tüm `shift_end_reports` o gün `produced_koli` katkı sağlıyor (completed-today olanlar hariç — double-count engel).
- **NEW FEATURE — Multi-Role Users**: Tek kullanıcı adı birden fazla rol alabilir (plan+depo, operator+depo vb.).
- Backend User modeli: `roles: List[str]` eklendi. Startup migration: eski `role` → `roles=[role]`.
- POST /api/users: `roles[]` veya `role` kabul ediyor. PATCH /api/users/{id}/roles: dinamik rol güncelleme.
- POST /api/users/login: expected role `user.roles[]` içinde kontrol ediliyor; 403 hatasında kullanıcının tüm rolleri listeleniyor.
- GET /api/users?role=X: hem `role==X` hem `roles` içerenler dönüyor.
- Frontend Yönetim Paneli Kullanıcılar sekmesi: 4-rol checkbox grid (Yeni Kullanıcı dialog), çoklu rol rozetleri + `×N` multi-role indicator, edit butonu ile dinamik rol güncelleme dialog.

### Feb 2026 (Iteration 26) — Tıklanabilir Metrik Kartları + Trend
- Metrik kartları artık motion.button — tıklayınca ilgili Tab'e geçiş + smooth scroll top.
- Tab eşlemesi: Bugünkü Üretim→analytics, Aktif İş/Bekleyen İş→machines, Aktif Makine→maintenance, Onay Bekleyen→pending-approval, Düşük Stok→paints.
- activeTab state ile Tabs controlled component'e dönüştürüldü (defaultValue yerine value/onValueChange).
- 'Bugünkü Üretim' kartında dün-bugün trend indicator: ▲/▼ percent + yesterday koli. dailyAnalytics.daily_stats'ten hesaplanıyor (week_offset===0 iken).
- Renk: yeşil (artış), kırmızı (düşüş), gri (değişmez).
- Erişilebilirlik: aria-label eklendi (her kart için "Metrik: değer. detay. Tab'e git.").
- whileHover -y3 + whileTap scale 0.98 micro-interaction.

### Feb 2026 (Iteration 25) — Operasyon Özeti Metrik Kartları
- ManagementFlow.js: Düşük Stok uyarısı altına 6 canlı metrik kartı eklendi (stat-card-industrial).
- Metrikler: Bugünkü Üretim (koli), Aktif İş + operatör sayısı, Bekleyen İş, Aktif Makine (working/total + bakımda), Onay Bekleyen, Düşük Stok.
- Her kart accent color (gold/emerald/blue/purple/amber/red) ile label/icon/metric/sub-text.
- Responsive grid: mobile 2, tablet 3, desktop 6 kolon.
- Staggered entrance animasyonu (motion.div, 0.05s step).
- Graceful empty states: 0 değerler gri renge düşüyor (pendingApprovals, lowStock).
- Hesaplamalar mevcut state'ten (jobs, machines, pendingReports, lowStockPaints) türetiliyor — yeni API çağrısı yok.

### Feb 2026 (Iteration 24) — Industrial UI Polish Pass (P2)
- Tailwind config extended: steel-blue accent palette (400-700), amber hierarchy (100-700), surface-elevated, border-subtle, text-muted, industrial shadow + grain bg-image.
- App.css industrial design system (lines 600+): .header-industrial, .panel-industrial, .panel-elevated, .stat-card-industrial, .badge-steel, .badge-gold, .live-dot, .section-label, .divider-industrial, .grain-overlay — all with light-theme variants.
- Typography refinements: tabular-nums, tighter letter-spacing for headings, .metric-display class.
- Custom scrollbar (industrial steel).
- ManagementFlow/PlanFlow/OperatorFlow: sticky industrial header with panel logo (B/P/O badge), 'Buse Kağıt + Panel Title' stacked label, live-dot for active shift, refined action buttons (icon-only on mobile, full on desktop), 40px+ touch targets.
- Amber focus-visible outline globally.

### Feb 2026 (Iteration 23)
- Home.js: '23 Nisan' banner text removed; all decorative animations (balloons, children, Atatürk, Türk bayrağı, cicekler) retained with pointer-events-none (mobile tap fix).
- ManagementFlow.js audit log pagination bug fixed: auditLogPage added to useEffect deps (Sonraki/Onceki now refetches).
- ManagementFlow.js fetchSecondaryData now uses Promise.allSettled — single endpoint failures no longer break dashboard.
- ManagementFlow.js fetchData: no more window.location.reload() loop on intermittent network errors.
- OperatorFlow.js: 'Musteriye Link Gonder' button added to active job card, uses navigator.share + clipboard fallback.
- PlanFlow.js QR dialog: 'Link Kopyala' → 'Link Paylas' (navigator.share).
- index.html: viewport-fit=cover, apple-mobile-web-app-status-bar-style=default, global CSS touch-action:manipulation, env(safe-area-inset-*) padding, -webkit-tap-highlight-color transparent — iPhone Safari tap/UI fixes.
- App.js: Firebase SW registration skipped on iOS and when PushManager unavailable (prevents hang on strict mobile networks).

## Upcoming Tasks
- P1: Sevkiyat & Surucu Modulu enhancements
- P2: Frontend bilesen refactoring (extract common Job/Modal/Table components from ManagementFlow/PlanFlow/OperatorFlow)
- P2: Overall UI polish pass (user requested holistic visual optimization)
- P3: Renk Gecis Optimizasyonu
- P3: Makine Bakim Planlayici
