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

### Feb 2026 (Iteration 30) — Cloudflare Worker Proxy + Subdomain Bypass
- **Frontend hostname auto-detect**: App.js artık alt domain'den geldiğinde (app./panel./portal.) `window.location.origin` kullanıyor. Aksi durumda eski REACT_APP_BACKEND_URL.
- **Cloudflare Worker kodu hazırlandı**: `/app/cloudflare-worker.js` — `app.bksistem.space` → `bksistem.space` görünmez proxy. WebSocket, API, statik dosyalar. Cookie domain temizleme + 3xx redirect rewrite.
- **CORS_ORIGINS güncellendi**: app./panel./portal. alt domainleri kabul eder.
- **Deployment rehberi**: `/app/CLOUDFLARE_WORKER_KURULUM.md` — 7 adımlı kurulum + sorun giderme.
- **Amaç**: TR ISS'lerin `bksistem.space` ana domain DNS/SNI engellemesini bypass — Worker, Cloudflare ağı içinde origin'e gidiyor.
- Preview ortamında regresyon test temiz, alt domain pattern eşleşmiyor → eski davranış korundu.

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
- P2: "Rol Degistir" butonu (multi-role users panel switch)
- P2: Network change listener (Wi-Fi <-> 3G adaptive timeout)
- P2: Frontend bilesen refactoring (extract common Job/Modal/Table components from ManagementFlow/PlanFlow/OperatorFlow)
- P3: Renk Gecis Optimizasyonu
- P3: Makine Bakim Planlayici

### Feb 2026 (Iteration 36) — Mobile CGNAT Login Fix + Bobin Module v3 (kg-only + Edit + External Destinations)
**Mobile login (P0 fix):** slowapi rate limit was blocking mobile users behind CGNAT shared IPs.
- New `/app/backend/rate_limit_utils.py` with `get_real_client_ip` reading CF-Connecting-IP / X-Forwarded-For / X-Real-IP for proxy-aware throttling.
- Bumped login limits: `/api/users/login` 10→120/min, `/api/drivers/login` 10→120/min, `/api/management/login` and `/api/dashboard/login` 10→60/min.
- All limiter instances (server.py, users.py, dashboard.py, logistics.py) now use `get_real_client_ip`.
- Verified: 30 sequential logins with X-Forwarded-For pass without 429.

**Bobin Module v3 (kg-only + Edit + External Destinations):**
- `/app/backend/routes/bobins.py` refactored: `total_weight_kg` is the primary metric; `quantity` (adet) is optional and defaults to 0. POST/purchase/to-machine/sale all accept `weight_kg` and validate against current stock.
- New endpoint: `PATCH /api/bobins/{id}` to fix incorrect entries (brand, width, grammage, color, weight, barcode, supplier). Audit-logged.
- Excel export updated to kg-only columns.
- `/app/frontend/src/pages/BobinFlow.js` updated:
  - Adet inputları kaldırıldı; tüm form alanları kg bazlı.
  - Her bobin kartına "Düzenle" butonu (`bobin-edit-{id}`) + edit dialog.
  - Stats: 3 kart yerine 2 kart (Bobin Çeşidi + Toplam Ağırlık).
  - Makineye Ver dropdown'ına 3 harici hedef eklendi: "27 Makine" (ext-27-makine), "SİES 33 Makine" (ext-sies-33-makine), "Deniz Grubu" (ext-deniz-grubu).
- 14/14 backend pytest passed; frontend dialogs verified via testing agent (iteration_36.json).

### Feb 2026 (Iteration 38) — Bobin Kat (TEK/CIFT/N) + Filtre Chip'leri + "Yonetim" Rolü
**Bobin Kat:**
- `Bobin` modeline `layers: int = 1` eklendi.
- Frontend Stoğa Ekle ve Düzenle dialog'larında "Kat *" Select: TEK / CIFT / Diger... (Diger için custom sayı kutusu).
- Aynı marka/ölçü/gramaj/renk **farklı kat** ayrı kayıt olarak gidiyor; aynı kat tekrar eklenince mevcut bobine merge oluyor.
- Bobin kartında yeşil rozet: TEK / CIFT / N KAT.
- Excel export'a "Kat" sütunu.

**Bobin Filtre Chip'leri:**
- BobinFlow stok sekmesine Kat filtreleri (Hepsi / TEK / CIFT / 3+ KAT) ve Renk filtreleri (Hepsi / Beyaz / Kraft / Diger) eklendi. Search bar ile birlikte AND filtresi olarak çalışıyor.

**"Yonetim" Rolü (P1):**
- `VALID_ROLES`'a `"yonetim"` eklendi (`/app/backend/routes/users.py`).
- Login mantığı (`POST /api/users/login`): yonetim rolüne sahip kullanıcının `roles` array'i otomatik `[operator, plan, depo, sofor, yonetim]` olarak expand ediliyor; expected_role check'i yonetim için bypass'lanıyor.
- Frontend ManagementFlow kullanıcı oluşturma/düzenleme dialog'larında "Yönetim" rol seçeneği (👑) eklendi.
- Sonuç: Yonetim user'ı her panele (operator, plan, depo/bobin, sofor) tek hesapla giriş yapabiliyor — test edildi.

### Feb 2026 (Iteration 39) — Yonetim Hızlı Panel + Bobin Detay Drawer + Arşiv + Sesli Bildirim

**Yonetim Hızlı Panel Geçişi:**
- `Home.js`: Yonetim rolüne sahip kullanıcı (herhangi bir local session'da `roles.includes("yonetim")`) için Ana Sayfa'da floating altın FAB (`👑 Hızlı Panel`).
- Tıklanınca açılan bottom-sheet'te 6 panel kartı (Yönetim/Plan/Operatör/Depo/Bobin/Canlı TV) — tek dokunuşla ilgili sayfaya gidiyor.

**Bobin Aylık Arşiv (kapsamlı Excel):**
- `GET /api/bobins/archive/months`: Geçmiş hareketlerin olduğu ayların listesi (YYYY-MM, son 36 ay).
- `GET /api/bobins/export?month=YYYY-MM`: O ayın **4 sayfalı** Excel arşivi:
  1. **Özet**: Bobin başına ay başı stok / ay içi giriş / ay içi makineye / ay içi satış / ay sonu stok / net değişim / hareket sayısı / aktif mi.
  2. **Hareketler**: Kronolojik tüm işlemler.
  3. **Makine Dağılımı**: Her makineye o ay verilen toplam kg + ortalama.
  4. **Müşteri Satışları**: Her müşteriye o ay satılan toplam kg.
- `GET /api/bobins/export` (paramsız) anlık snapshot — yine 4 sayfalı zenginleştirildi.
- Frontend BobinFlow header'da `Archive` butonu → ay seçici dialog → "İndir".

**Bobin Detay Drawer:**
- BobinFlow stok kartında bobin info bölümüne tıklayınca alt yarıdan açılan slide-up drawer.
- `GET /api/bobins/movements?bobin_id=...&limit=50` ile o bobinin son 50 hareketi (alış/makineye/satış renkli rozetlerle, tarih+kg+hedef+kullanıcı).
- Mobil için optimal: backdrop click ile kapanır, sticky header bobin özetini gösterir.

**Sesli + Titreşimli Bildirim (Operatör):**
- Yeni helper: `/app/frontend/src/utils/notify.js` — Web Audio API ile bip + `navigator.vibrate` titreşimi. 3 mod: `urgent`, `default`, `subtle`.
- OperatorFlow WebSocket olaylarına bağlandı:
  - Vardiya sonu bildirimi → `urgent` (3'lü uyarı + uzun titreşim).
  - Yeni mesaj → `default` (ding-dong + kısa titreşim).
- Tarayıcı autoplay kısıtlaması için ilk dokunuşta AudioContext otomatik resume oluyor.

