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


### Feb 2026 (Iteration 40) — Depo "Tamamlanan İşler" Sekmesi
**Yeni Sekme (`/warehouse`):**
- `WarehouseFlow.js`: Yeni "Tamamlanan İşler" tab'ı (CheckCircle2 ikonu) — depo çalışanları tamamlanan işleri, hangi makinenin yaptığını ve kaç koli üretildiğini görür.
- Veri kaynağı: `GET /api/jobs?status=completed` (her 5sn fetchData içinde yenilenir).
- Filtreler: Arama (iş adı / makine / renk), Makine seçici (otomatik liste), Tarih aralığı (Son 24 Saat / 7 Gün / 30 Gün / Tümü) — varsayılan 30 gün.
- Üst rozetler: toplam iş sayısı + toplam koli (filtre uygulanmış toplam).
- Masaüstü: tablo (İş Adı, Makine pill, Renk, Koli completed/target, Operatör, Tamamlandı timestamp), tamamlanma tarihine göre desc sıralı.
- Mobil: aynı veri kart formatında (responsive).
- Mobil tab grid `grid-cols-3`'e güncellendi (5 sekme).
- Verifiye: 19 İş / 744 Koli depo paneli üzerinde gerçek veri ile e2e test.


### Feb 2026 (Iteration 41) — Vardiya Devamlılığı + Canlı Pano Kısmi Üretim + Depo "Beni Hatırla"

**Kritik Bug Fix #1 — Vardiya bitince operatör/Canlı Pano "BOŞTA" kalıyordu:**
- Sorun: `POST /api/shifts/end-with-report` makineyi `idle` yapıyor ama job status'ünü güncellemediği için job `in_progress` olarak takılıyordu. Sonraki `start_shift` filtresi (`status == "pending" AND completed_koli > 0`) bu işleri yakalamıyordu.
- Düzeltme (`/app/backend/routes/shifts.py`):
  - `end-with-report`: Her rapor için `total_completed = prev_completed + produced_koli` doğru hesaplanıyor (önceki overwrite bug'ı fix). İş bitmediyse `status="pending"` (started_at korunuyor); bittiyse `status="completed"` + `completed_at` set ediliyor.
  - `start_shift`: Resumption filtresi gevşetildi → `status="pending" AND started_at exists AND completed_koli < koli_count` olan tüm işler yeni vardiyada otomatik devam ediyor (kısmi üretim koşulu kaldırıldı; 0 üretmiş ama atanmış işler de resume oluyor). `started_at` korunuyor (yenilenmiyor).
- E2E test: Job → produced=30/100 ile vardiya bitti → `status=pending, completed_koli=30, remaining=70` ✓ → Yeni vardiya başlatıldı → job otomatik `in_progress`, makine `working` ✓.

**Kritik Bug Fix #2 — Vardiya bitirme formundaki üretim Canlı Pano/Yönetim "Bugünkü Üretim"e işlemiyor:**
- Sorun: `GET /api/dashboard/live` ve ManagementFlow "Bugünkü Üretim" kartı yalnızca `completed_today` jobs'ından `completed_koli` topluyordu — `shift_end_reports.produced_koli` (yarım üretimler) hiç dahil edilmiyordu.
- Düzeltme (`/app/backend/routes/dashboard.py` + `ManagementFlow.js`):
  - `koli_today` artık: (bugün tamamlanan jobs'ların `completed_koli`'si - bugün aynı job için raporlanmış kısmi üretim) + bugünkü tüm `shift_end_reports.produced_koli`. Çifte sayım önlendi.
  - `daily_koli` (7 gün) ve `operator_ranking` aynı mantıkla genişletildi.
  - Yeni filtre: `GET /api/shift-reports?today=true`.
  - `ManagementFlow.js` `fetchData` artık `todayShiftReports` state'ini paralel olarak çekiyor; "Bugünkü Üretim" kartı bunu hesaba katıyor.

**Yeni Özellik — Depo "Hatırla Beni":**
- `WarehouseFlow.js` login formuna `data-testid="warehouse-remember-me"` checkbox eklendi (PlanFlow/OperatorFlow ile aynı UX).
- Checked iken `localStorage.depo_remember = {username, password}` kayıt; sayfa açılışında pre-fill.
- 24 saatlik oturum kalıcılığı korundu (depo_session — token tabanlı, ayrı bir mekanizma).


### Feb 2026 (Iteration 42) — Genişletilmiş Görsel Desteği + Bekleyen İşlerde Görsel Önizleme

**Backend — Tüm yaygın resim formatları kabul ediliyor:**
- `POST /api/upload/image` (`/app/backend/routes/jobs.py`) genişletildi:
  - Eski: jpg, jpeg, png, gif, webp (5MB)
  - Yeni: jpg/jpeg/jfif/pjpeg, png/apng, gif, webp, avif, bmp/dib, svg/svgz, tif/tiff, heic/heif/heics/heifs, ico/cur (10MB)
  - Bilinmeyen uzantı olsa bile `content-type` "image/*" ise kabul ediyor.
  - Doğru MIME tipi ile data URL'e dönüştürülüyor.
- Test edildi: BMP, SVG, TIFF dosyaları başarıyla yüklenip data URL olarak depolanıyor.

**Frontend — Görselin "büyütülebilir" gösterimi:**
- **OperatorFlow** bekleyen iş kartlarında: Görsel artık küçük ikon butonu yerine **16×16 (mobil) / 20×20 (masaüstü) thumbnail** olarak iş kartının solunda gösteriliyor. Üzerine basınca tam ekran dialog ile büyüyor. Drag-and-drop ile çakışmasın diye `onMouseDown`/`onTouchStart` propagation engellendi.
- **OperatorFlow** aktif iş thumbnail'i: `window.open` yerine artık aynı dialog'u açıyor (tutarlı UX).
- **OperatorFlow** Görsel Önizleme Dialog: max-w-3xl → max-w-4xl, data URL desteği eklendi (önceden `${API}` prefix data URL'i bozuyordu).
- **ManagementFlow** Bekleyen İşler listesi: Her bekleyen işin yanına 12×12 thumbnail eklendi → tıklanınca yeni eklenen "Görsel Önizleme Dialog"u açıyor.
- **ManagementFlow** Aktif İş thumbnail'i: `window.open` yerine artık dialog kullanıyor; thumbnail büyütüldü (12×12 → 14×14) ve hover scale animasyonu eklendi.
- **ManagementFlow**'a yeni state: `selectedJobImage`, `isImagePreviewOpen`, `openImagePreview` helper + max-w-4xl Image Preview Dialog.


### Feb 2026 (Iteration 43) — Marka Stok Modülü (Bitmiş Ürün Takibi)

**Yeni Modül — Bitmiş ürünleri (Deniz 33, Banko, vs.) marka+makine+renk bazında stok takibi:**

**Backend (`/app/backend/routes/brand_stock.py` + `models.py`):**
- 2 yeni Pydantic modeli: `BrandStock` (mevcut stok), `BrandStockMovement` (hareket logu — in/out/adjustment).
- 9 endpoint: templates, list, add (merge), sell, edit, delete, movements, summary, Excel export.
- Şablonlar: **Deniz 33** → 33 ICM / SİES; **Banko** → ICM / Büyük Makine (renk opsiyonel serbest metin).
- Tüm hareketler `audit_logs`'a yazılıyor (kim, ne zaman, ne yaptı).
- E2E test: Add (+100) → Add merge (+30 → 80) → Sell (-30 → 70) ✓

**Frontend (`/app/frontend/src/pages/MarkaStokFlow.js`):**
- Route: `/marka-stok` — Depo / Planlama / Yönetim rollerine açık.
- Marka kartları (Deniz 33 toplam, Banko toplam) + 30 günlük giriş/satış özeti.
- Stok kartları: marka + makine pill + renk pill + adet + Sat/Düzelt/Sil.
- Stok Ekle: Marka → makine seçenekleri dinamik; renk opsiyonel; adet + not.
- Sat: müşteri + adet + not, stok limit kontrolü.
- Düzelt: yanlış kayıt düzeltmesi (delta = "adjustment" hareketi).
- Detay drawer: stok kartına tıklayınca o kayda ait son 100 hareket alt-modal'da.
- Hareketler tablosu, marka/makine filtreleri, arama, Excel export (2 sayfa).
- 24 saatlik oturum + Hatırla Beni.


### Feb 2026 (Iteration 44) — Marka Stok: Custom Marka + Kart "+ Ekle" Butonu

**Backend (`brand_stock.py` + `models.py`):**
- `BrandStock.machine` ve `BrandStockMovement.machine` Optional yapıldı (custom markalar için makine zorunlu değil).
- `POST /brand-stock` artık makine alanını opsiyonel kabul ediyor; merge mantığı `machine in [None, ""]` kontrolüne genişletildi.
- E2E test: "Lüks Servis" custom marka makine olmadan +40 ekleme, sonra +10 merge → 50 adet ✓

**Frontend (`MarkaStokFlow.js`):**
- Stok Ekle dialog'da marka select'in altına **"+ Diğer (Yeni Marka)..."** seçeneği eklendi. Seçilince marka select metin kutusuna dönüşüyor (geri butonu ile şablon listeye dönülebiliyor).
- Custom marka aktifken makine alanı "Makine (Opsiyonel)" olarak metin kutusu; bilinen marka aktifken hâlâ select (33 ICM / SİES vs. ICM / Büyük Makine).
- Validasyon: bilinen markada makine zorunlu, custom markada zorunlu değil.
- Her stok kartına yeni **"+ Ekle"** butonu eklendi (`quick-add-{id}`) — tıklayınca Stoğa Ekle dialog'u o kartın brand+machine+color bilgileriyle pre-fill açılıyor; kullanıcı sadece adet girip kaydediyor (merge ile mevcut stoğa eklenir).
- Custom marka ile oluşturulan kartlara da "+ Ekle" tıklayınca aynı flow custom mode'da açılıyor.

**Erişim:** Home.js modules + Yönetim Quick Panel'de "Marka Stok" kısayolu.


### Feb 2026 (Iteration 45) — Veritabanı Yedekleme + LITE MOD

**Yedekleme** (`/app/backend/routes/backups.py`):
- APScheduler ile her gün **03:00 UTC** otomatik `mongodump --gzip --archive` → `/app/backups/backup_YYYYMMDD_HHMMSS.archive.gz`.
- Son **7 gün** saklanır, eski dosyalar otomatik silinir.
- Sadece Yönetim erişebilir (roller: `yonetim`, `management`).
- Endpoints: `GET /admin/backups`, `POST /admin/backups/run`, `GET /admin/backups/download/{file}`, `DELETE /admin/backups/{file}`.
- ManagementFlow header'ına **"Yedek"** butonu eklendi → dialog: liste, "Şimdi Yedek Al", indir, sil + sonraki otomatik zaman.
- E2E test: Manuel run → 180 KB archive ✓ listele ✓.

**LITE MOD** (`App.js` + `App.css`):
- localStorage `lite_mode` → `<html class="lite-mode">`.
- Global CSS overrides: `animation-duration` / `transition-duration` → 0.001ms; `backdrop-blur-*` + `blur-*` → none; `live-dot` animasyonsuz; ağır shadow'lar minimize.
- Home.js'de düşen balonlar + çocuk siluetleri lite modda render edilmiyor.
- Ana sayfa header'ında **Gauge** ikonlu toggle (yeşil = aktif). Tüm panellere `liteMode` + `toggleLiteMode` prop'u geçirildi.
- Tercih localStorage'da kalıcı.



## Bug Fix - 12 May 2026
- **P0 Crash:** `ManagementFlow.js` içinde `Database is not defined` ve devamında `HardDrive is not defined` ReferenceError'ları giderildi.
- Çözüm: `lucide-react` importuna `Database` ve `HardDrive` ikonları eklendi (line 4).
- Etki: Yönetim paneli (`/management`) yeniden hatasız açılıyor; Yedek dialogu çalışıyor.
- Test: Screenshot smoke test başarılı; konsolda ReferenceError yok.



## ESLint Strict Mode - 12 May 2026
- **Amaç:** "Database is not defined" / "HardDrive is not defined" gibi eksik import hatalarının build aşamasında yakalanması.
- **Uygulama:** `craco.config.js` içindeki eslint kurallarına `"react/jsx-no-undef": "error"` ve `"no-undef": "error"` eklendi.
- **Etki:** Eksik bir import varsa dev server hata gösterir, CI build (`CI=true yarn build`) fail eder.
- **Yan kazanım:** `PlanFlow.js` içindeki tanımsız `setEditingJob` çağrıları (ölü kod) bu sayede yakalandı ve temizlendi.
- **Test:** Database/HardDrive importları geçici olarak kaldırılıp build koşuldu, kural beklenen 4 hatayı raporladı. Sağlam build başarılı (24.15s).


## Production Hotfix - 13 May 2026

### 1. Yedekleme Python Fallback (P0)
- **Sorun:** Production sunucusunda `mongodump` binary'si yok → "Şimdi Yedekle" hatası: `[Errno 2] No such file or directory: 'mongodump'`.
- **Çözüm:** `routes/backups.py` içinde `_python_bson_backup()` fonksiyonu eklendi. `subprocess.run(["mongodump", ...])` `FileNotFoundError` fırlatırsa pymongo + BSON ile her collection tar.gz'a yazılır.
- **Dosya formatı:** Aynı isim (`backup_TS.archive.gz`). Restore için pymongo ile manuel açılabilir (tar içinde `*.bson` dosyaları).
- **Response field:** `method` → `"mongodump"` veya `"python_bson"`.
- **Test:** Python fallback üretilen arşiv 31 collection içerdi, 190KB.

### 2. 23 Nisan Teması Tarih Duyarlı (P1)
- **Sorun:** 13 Mayıs olmasına rağmen ana sayfada balon yağmuru, düşen çocuk siluetleri ve bayraklı çocuklar hala görünüyordu.
- **Çözüm:** `Home.js` içine `isAprilTheme = time.getMonth() === 3` flag'i eklendi. Aşağıdaki 4 render bloğu artık yalnızca Nisan ayında gösteriliyor:
  - `fallingBalloons` (düşen balonlar)
  - `fallingChildren` (düşen çocuk siluetleri)
  - `groundChildren` (oynayan çocuklar)
  - `flagChildren` (bayrak tutan çocuklar)
- **Atatürk + bayrak + tema toggle her zaman görünür (Türkiye kimlik unsurları).**

### 3. Mobil Bayrak/Başlık Çakışması (P2)
- **Sorun:** Mobilde sağ üstteki bayrak "BUSE KAGIT" başlığına biniyordu.
- **Çözüm:** Main content container'a `pt-24 sm:pt-28` üst padding eklendi (`py-8` → `pt-24 sm:pt-28 pb-8`).
- **Doğrulama:** Ekran görüntüsü ile title-bayrak ayrımı görüldü.

