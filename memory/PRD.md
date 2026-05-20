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



## Bobin Veri Bütünlüğü Fix - 13 May 2026

### Sorun
"Hayat" markası için +1947 alış ve -970 makineye çıkışına rağmen üst kartta hala 1947 kg görünüyordu (matematik tutmadı).

### Kök Sebep
`to-machine` ve `sale` endpoint'leri **read-then-update** deseniyle çalışıyordu: önce `find_one` ile mevcut ağırlık okunup, hesaplanmış `new_weight` `$set` ile yazılıyordu. Eşzamanlı iki istek arasında race condition oluşunca biri diğerini eziyordu.

### Çözüm

1. **Atomik `$inc` düşürme** — `routes/bobins.py` `to-machine` ve `sale` endpoint'leri `find_one_and_update` + `$inc` ile yenilendi. Filter olarak `total_weight_kg >= weight_out` koşulu eklendi → yetersiz stoğa düşürme atomik olarak reddedilir.
   - Race condition tamamen önlendi.
   - `weight_per_piece_kg` yan-hesap için ikinci hızlı update yapılıyor (kritik veri zaten atomik korunuyor).
   - `ReturnDocument.AFTER` ile güncel doc dönülüyor.

2. **`POST /api/admin/bobins/recalculate`** — Tüm bobinlerin `total_weight_kg` ve `quantity` değerlerini `bobin_movements`'tan yeniden hesaplayan endpoint:
   - Formül: `SUM(purchase) - SUM(to_machine) - SUM(sale)`.
   - MongoDB aggregation pipeline (tek query, performanslı).
   - Sadece farklı olanları update eder, response'ta düzeltilen kayıtların listesini döner (`fixed[]` → old_weight, new_weight, diff_kg).
   - Yetki: `yonetim`, `management`, `depo`, `planlama` rolleri.

3. **UI Butonu** — `ManagementFlow.js` header'da "Bobin Yeniden Hesapla" butonu (data-testid: `bobin-recalc-btn`). Onay sonrası raporu toast + alert ile gösterir.

### Doğrulama (Curl Test)
- Test bobin: 1947kg alış, 970kg makineye → API döndü: `new_weight: 977.0` ✅
- DB'de manuel olarak 1947 olarak bozuldu → recalculate çağırıldı → `fixed_count: 1, diff_kg: -970, new_weight_kg: 977` ✅
- ReferenceError yok, UI butonu görünür ve çalışır.

### Production'da Kullanım
Production'daki "Hayat" bobini gibi tutarsız kayıtları düzeltmek için:
1. Yönetim paneline gir.
2. Header'da **"Bobin Yeniden Hesapla"** butonuna bas.
3. Onayla → tüm bobin stokları hareket geçmişine göre yeniden hesaplanır.



## Performans Optimizasyonu - 13 May 2026

### Bulgular (ölçüm önce)
- `/api/jobs` 68.8 KB (gzip 40.7 KB) — sadece 2 işin base64 image_url'si payload'un **%72'sini** oluşturuyordu.
- `/api/visitors` 36 KB — user_agent ve sayfa metaları gereksiz şişiriyordu.

### Yapılan Değişiklikler

**Backend**
1. `routes/jobs.py` — `GET /api/jobs` projection `image_url: 0`; ek query ile `has_image: bool` flag eklendi.
2. **Yeni endpoint** `GET /api/jobs/{job_id}/image` — sadece image_url döndürür. Lazy load için.
3. `routes/jobs.py` paused listesi de image_url exclude.
4. `routes/dashboard.py` — active/pending/completed_today/completed_7d jobs query'lerinde image_url exclude.
5. `routes/analytics.py` — tüm jobs.find çağrılarında image_url exclude (toplu sed).
6. `routes/visitors.py` — default limit 100→50, user_agent exclude.
7. `models.py` — Job modeline `has_image: Optional[bool]` eklendi.

**Frontend**
1. **3 dosyada (Plan/Operator/Management)** `openImagePreview(jobOrUrl)` polymorphic yapıldı:
   - String URL gelirse direkt göster (geriye dönük uyum).
   - Job objesi gelirse: image_url varsa kullan, yoksa `has_image && id` ise `GET /api/jobs/{id}/image` ile lazy fetch et.
2. Thumbnail render mantığı `(job.image_url || job.has_image)` koşuluna güncellendi:
   - image_url cached varsa normal `<img>` render.
   - Sadece has_image varsa "Resmi Göster" ikonu butonu — tıklayınca lazy fetch + preview dialog.
3. `PlanFlow.openEditJob` ve `loadExistingJob` — düzenleme dialog'u açılırken eğer `has_image` varsa image lazy fetch ile form'a yüklenir.

### Ölçülen Kazanç
| Endpoint | Önce (raw / gzip) | Sonra (raw / gzip) | Azalma (gzip) |
|---|---|---|---|
| `/api/jobs` | 68.8 KB / 40.7 KB | **20.3 KB / 3.86 KB** | **%90.5** 🚀 |
| `/api/visitors` | 36.5 KB / ~8 KB | **11.8 KB / 1.8 KB** | **~%77** |
| `/api/dashboard/live` | ~1 KB / 936 B | 936 B / **376 B** | ~%60 |

### Test Sonuçları
- Backend pytest: **11/11 ✅** (`/app/backend/tests/test_iteration37_payload.py`)
- Atomic deduction doğrulandı: 1947 - 970 = 977 kg ✅, sıralı çıkartmalar: 1947 - 970 - 500 = 477 kg ✅
- Recalculate endpoint: yapay olarak bozulmuş weight düzeltildi ✅
- Frontend Playwright: lazy load image network call yakalandı, recalc butonu çalışıyor ✅
- Test raporu: `/app/test_reports/iteration_37.json`



## Bobin Detay Modalı Konumlandırma - 13 May 2026
- **Sorun:** Bobin kartına tıklanınca detay sheet'i sayfanın en altından (bottom drawer) açılıyordu, mobilde ekranı yarıya kapatıyor, masaüstünde ekranın altında küçük görünüyordu.
- **Çözüm:** `BobinFlow.js` line 994 — fixed bottom drawer **merkez modal**'a çevrildi:
  - Container: `fixed inset-0 flex items-center justify-center p-4`
  - Animation: `y: "100%"` (alt slide) → `scale 0.92 + y:12` (merkez fade-in)
  - Max width: `max-w-2xl`, max-h `85vh`, içerik scroll'lu
  - Backdrop: `backdrop-blur-sm` + bg-black/70
- **Sonuç:** Modal artık her ekran boyutunda merkezde açılır, kullanıcı kartla aynı görsel hizada detayı görür.
- Doğrulama: Desktop ekran görüntüsü ile modal merkezde, "Hayat" detay sheet'i blur backdrop ile render edildi.



## Hetzner VPS Migrasyon Hazırlığı - 13 May 2026

Kullanıcı production'ı **Hetzner CPX21 (Falkenstein, Almanya)** üzerinde self-host etmek istiyor. Sebep: Türkiye ISP'lerinde 4G mobil bağlantı sorunu (SNI/DNS engelleme). Hetzner Almanya IP'leri TR ISP blok listelerinde yok ve TR'ye ~25-35ms latency veriyor.

### Hazırlanan Deployment Paketi (`/app/deploy/`)
- **`MIGRATION_RUNBOOK.md`** — Adım adım geçiş rehberi (önkoşullar, SSH key, DNS, kurulum, restore, smoke test, cutover, geri dönüş planı)
- **`setup.sh`** — VPS initial setup (Python 3.11, Node 20, MongoDB 7.0, Nginx, Certbot, UFW, fail2ban, buse user)
- **`buse-backend.service`** — systemd unit (uvicorn, 2 workers, hardening flags)
- **`nginx.conf`** — Reverse proxy (rate limit, gzip, SPA fallback, WS support, security headers, SSL ready)
- **`proxy_params`** — Standart proxy header set
- **`deploy.sh`** — Update script (pre-deploy backup, git pull, deps, build, restart)
- **`backup.sh`** — Cron-friendly mongodump (30 gün retention, optional rclone off-site)
- **`restore.sh`** — Disaster recovery (mongodump VEYA Python BSON fallback otomatik tespit + pre-restore safety yedek)
- **`.env.backend.example`** — VPS backend env template
- **`.env.frontend.example`** — VPS frontend env template

### Geçiş Stratejisi (zero data loss)
1. VPS açılır + `setup.sh` çalıştırılır.
2. Kod yüklenir, `.env` doldurulur, `yarn build` yapılır, systemd başlatılır.
3. Nginx + Let's Encrypt SSL kurulur.
4. **Emergent'tan en güncel yedek alınır → VPS'e SCP → mongorestore.**
5. DNS değişmeden hosts override ile smoke test (yönetim girişi, plan ekleme, WS, bobin recalc, yedek alma).
6. **Cutover (Pazar gecesi):** Son yedek → restore → DNS bksistem.space A kaydını Hetzner IP'ye → TTL 300s ile 5dk yayılır.
7. 24-48 saat Emergent ayakta kalır (geri dönüş için). Sorun çıkarsa DNS'i geri çevir → eski sistem.

### Kullanıcının Bekleyen Adımları
- [ ] Hetzner hesabı aç + CPX21 oluştur (Falkenstein, Ubuntu 22.04)
- [ ] SSH key kurulumu
- [ ] VPS IP'sini bana ilet
- [ ] Beraber `setup.sh` → kod yükleme → restore → cutover

### Maliyet
- Hetzner CPX21: ~5.83 €/ay (~200 ₺)
- Let's Encrypt SSL: ücretsiz
- Toplam: **~205 ₺/ay** (önceki Emergent'a göre çok daha ucuz + TR'ye düşük latency)



## Ana Sayfa — Soft Geçiş Banner'ı - 13 May 2026

### Sorun
Cutover öncesi kullanıcıları yeni Hetzner sistemine (`https://yeni.bksistem.space`) yumuşak biçimde yönlendirmek; ama eski paneller `bksistem.space` üzerinden hala erişilebilir kalsın.

### Çözüm
`Home.js`'de soft-cutover akışı:
1. **Büyük yeşil/cyan gradient banner** ana sayfada — `🚀 YENI SISTEM` ikonu, "Daha Hızlı, Daha Güvenli" başlığı, `yeni.bksistem.space` URL'i ve "Geç →" CTA butonu. Tıklayınca https://yeni.bksistem.space açılır.
2. **Module kartları varsayılan gizli** — `showLegacyPanels` state false başlar.
3. **Altta küçük gri toggle link** — `"Eski panel girişleri (geçici)"` → tıklanınca modüller görünür, tekrar tıklayınca gizlenir.
4. **Atatürk + Bayrak + Hız Modu + Tema toggle** her zaman görünür.
5. **Yönetim Hızlı Panel FAB** — yönetim rolündeki kullanıcılar için sağ altta hala görünür (alışkanlık değişmesin).

### Avantaj
- Cutover gerek yok, DNS dokunulmadı.
- Eski URL'le gelenler banner görüp yeni sisteme yönelir.
- Henüz hazır olmayan istemciler "Eski paneller" linkiyle eski sistemden devam edebilir.
- Geçiş tamamlandığında banner kaldırılır veya tüm trafik kalıcı redirect ile yeni sisteme yönlendirilir.

### Deploy
Kullanıcı Emergent panelinde Save → Deploy yapacak; Hetzner VPS'e dokunulmadı.



## Beklenen Toplam Koli Özeti — 19 May 2026

### Problem
Yönetim, Plan, Depo ve Canlı Pano üretilmesi beklenen toplam koli sayısını net göstermiyordu. Operatör de kendi makinesinin yüklemesini panelde göremiyordu. Kullanıcı tüm bu görüşlerin aynı anda iş tamamlama ve vardiya sonu raporlarıyla **otomatik düşmesini** istedi.

### Çözüm — Backend
- **YENİ endpoint:** `GET /api/jobs/expected-summary` (auth gerekli, opsiyonel `?machine_id=` filtresi)
  - Aktif kuyruk = `status in [pending, in_progress, paused]`
  - Hesap: `remaining = max(0, koli_count - completed_koli)` her iş için
  - Response: `{ total_remaining_koli, total_target_koli, total_completed_koli, total_jobs, completion_pct, by_machine: [...] }`
- `GET /api/dashboard/live` response'una `summary.expected_summary` field'ı eklendi (paused işleri de dahil).
- Mevcut shift onay akışı zaten `completed_koli`'yi `$inc` ile güncellediği için kalan sayı OTOMATIK düşer.
  - Vardiya sonu rapor onayı → `completed_koli` artar → remaining düşer ✅
  - İş `status=completed` olduğunda → kuyruktan çıkar ✅

### Çözüm — Frontend (5 panel)
- **YENİ component:** `/app/frontend/src/components/ExpectedKoliSummary.js`
  - 3 variant: `compact`, `large`, `dark-tv`
  - Helper: `computeExpectedSummary(jobs, machineId?)` — server endpoint erişilemezse fallback
- **Yönetim** (`ManagementFlow.js`): large variant, üst kısımda büyük altın kart
- **Plan** (`PlanFlow.js`): compact variant, makine grid'inin altında
- **Depo** (`WarehouseFlow.js`): compact variant, başlığın altında
- **Canlı Pano** (`LiveDashboard.js`): dark-tv variant, TV için optimize
- **Operatör** (`OperatorFlow.js`): compact variant, sadece kendi makinesinin remaining koli'si

### data-testid'ler
`management-expected-koli`, `plan-expected-koli`, `warehouse-expected-koli`, `dashboard-expected-koli`, `operator-expected-koli`

### Test Sonuçları (iteration_38.json)
- Backend: 8/8 pytest passed (auth, hesap doğruluğu, by_machine, machine_id filter, dashboard/live entegrasyonu)
- Frontend: 5/5 panel doğrulandı (DOM, sayı eşleşmesi, operatör filtresi)
- Mevcut veri: 283 koli kalan, 7 aktif iş, %9.6 tamamlandı (30/313)

### DRY Notu (gelecekte refactor)
- `_build_expected_summary` (dashboard.py) ve `/jobs/expected-summary` (jobs.py) hesabı aynı (~30 LOC) — ileride ortak helper'a taşınabilir.

---

## SSL — www.bksistem.space Durumu (19 May 2026)

### Tespit
- `bksistem.space` ✅ HTTP 200, SSL OK
- `yeni.bksistem.space` ✅ HTTP 200, SSL OK
- `www.bksistem.space` ❌ SSL SAN listesinde yok (sertifika sadece `bksistem.space` + `yeni.bksistem.space` kapsıyor)
- DNS `www.bksistem.space` → `178.105.135.9` ✅ doğru ayarlanmış

### Çözüm (VPS'te kullanıcı tarafından çalıştırılmalı)
```bash
ssh user@178.105.135.9
sudo certbot --expand --nginx \
  -d bksistem.space -d www.bksistem.space -d yeni.bksistem.space \
  --email <email> --agree-tos -n
sudo systemctl reload nginx
```


## Makine Bazlı Kırılım Pop-up (Bonus) — 19 May 2026

### Eklendi
- `ExpectedKoliBreakdownDialog` ve `ExpectedKoliCard` bileşenleri (`ExpectedKoliSummary.js` içinde).
- Pop-up içinde her makine için: kalan koli, iş sayısı, toplam yükteki payı (%), tamamlanma %'si, ilerleme barı, "X / Y koli üretildi" detayı.
- Makineler kalan koli sayısına göre azalan sıralanır (en yoğun en üstte).
- Footer: Genel ilerleme yüzdesi + tamamlanan/hedef koli.
- Klavye erişimi: Enter/Space ile aç, X butonu veya dışına tıklayarak kapat.

### Entegre edilen sayfalar
- **Yönetim** (`ManagementFlow.js`): Large variant kart → tıkla → pop-up
- **Plan** (`PlanFlow.js`): Compact variant kart → tıkla → pop-up
- Depo, Operatör, Canlı Pano kartları tıklanmaz kaldı (gerek görülmedi).

### data-testid'ler
`management-expected-koli-dialog`, `plan-expected-koli-dialog`, `breakdown-row-{machine_name}`, `breakdown-close-btn`

### UX cue
- Kart üzerinde "Makine Detayı →" rozeti (large variant) veya sağda chevron ikonu (compact)
- Hover'da renk değişimi ve gölge


## Drill-down + Plan Hızlı İş Ekleme — 19 May 2026

### Eklenenler
- Pop-up'taki makine satırları **tıklanabilir**: tıklayınca o makinenin **iş listesi drill-down** görünür.
- Her iş satırında: durum etiketi (Çalışıyor / Bekliyor / Durduruldu), iş adı, kalan koli, ilerleme barı, "X / Y koli üretildi", renkler.
- İşler sıralı: önce in_progress, sonra paused, sonra pending (order'a göre).
- **← Geri** butonu ile makine listesine dön.

### Plan paneli özel hızlı eylem
- Drill-down ekranının altında **"+ Bu Makineye Yeni İş Ekle"** butonu (sadece Plan'da görünür)
- Tıklanınca: pop-up kapanır, **Yeni İş Ekle** formu açılır, **makine alanı önceden doldurulmuş** olarak gelir.
- Yönetim panelinde bu buton görünmez (sadece görüntüleme — `onCreateJob` prop verilmedi).

### Implementation
- `ExpectedKoliBreakdownDialog` yeni props: `jobs` (drill-down için), `onCreateJob(machine)` (Plan'da set edilir).
- `ExpectedKoliCard` aynı props'u proxy eder.
- `PlanFlow.js` `onCreateJob` callback'i: `setFormData({...prev, machine_id, machine_name})` + `setIsDialogOpen(true)`.
- `allJobs` state'i (Plan zaten tutuyordu) drill-down için kullanıldı (in_progress + paused dahil).

### data-testid'ler
`breakdown-back-btn`, `breakdown-job-{job_id}`, `breakdown-create-job-btn`

### Test

## Global Çift-Tıklama / Çift-Submit Koruması — 20 May 2026

### Problem
Kullanıcılar bir butona bastıklarında sunucudan cevap gelene kadar (~1-2 saniye) **hiçbir görsel geri bildirim** alamadığı için bastıklarından emin olamayıp 2-5 kez tıklıyordu. Sonuç: aynı iş, aynı bobin, aynı sevkiyat birkaç kez ekleniyordu.

### Çözüm
**Global Shadcn `Button` bileşeni** (`/app/frontend/src/components/ui/button.jsx`) genişletildi. Tüm app'teki butonlar otomatik korunur — caller'lara hiçbir değişiklik gerekmedi.

#### Davranış
1. `onClick` handler bir **Promise döndürürse** (async fonksiyon), buton otomatik:
   - `disabled` durumuna geçer (CSS `pointer-events: none; opacity: 50%`)
   - İçeriğinin başına **`Loader2` dönen spinner** eklenir
   - `aria-busy="true"` eklenir
2. **`useRef` guard** — React render'dan bağımsız olarak süregelen Promise varken yeni tıklama hemen yutulur (preventDefault + stopPropagation).
3. Promise tamamlanınca buton eski haline döner.
4. **Sync onClick handlers** (örn. `setOpen(true)`, navigation) etkilenmez — Promise döndürmediği için pending state hiç açılmaz.
5. `asChild=true` durumunda spinner enjekte edilmez (Slot çocuk düzenini bozmamak için), sadece re-entry guard çalışır.

### Etkilenen Akışlar (otomatik korumalı)
- 🛡️ Bobin: Ekle / Sat / Makineye Ver / Düzenle / Sil / Excel Export
- 🛡️ Plan: Yeni İş / Düzenle / Sil / Hızlı Aktar / Sevkiyat / Mesaj
- 🛡️ Operatör: İş Tamamla / Durdur / Başlat / Malzeme Talep / Vardiya Raporu
- 🛡️ Depo: Talep Onayla / Sevkiyat Logu / Palet İşlemleri
- 🛡️ Yönetim: Rapor Onayla / Kullanıcı Oluştur / Mesaj / Bobin Yeniden Hesapla / Menü Kaydet

### Test (smoke)
- Plan'da "Yeni İş Ekle" butonuna art arda **5 hızlı tıklama** → backend'e sadece **1 POST** gitti, **1 iş** oluştu ✅
- Kullanıcı tıklarken anında spinner görüyor → "bastığımdan emin değilim" hissi ortadan kalktı

### Bonus
Bu değişiklik **geriye dönük tam uyumlu**: hiçbir mevcut handler güncellenmedi, yeni butonlar otomatik korunuyor.

- Yönetim: 40x40 ICM → 2 iş listesi (TEST_Diagnostic 70 koli, İldo 50 koli), create btn YOK ✅
- Plan: aynı drill-down + create btn AÇIK → tıkla → Yeni İş Ekle dialogu makine önceden doldurulmuş şekilde açıldı ✅


## Idempotency-Key Backend + Frontend — 20 May 2026

### Eklenenler
- **Backend middleware** `/app/backend/middleware/idempotency.py`:
  - POST/PUT/PATCH/DELETE isteklerinde `Idempotency-Key` header varsa MongoDB cache'ine bakar.
  - Tamamlanmış kayıt varsa → cached response döner (`X-Idempotent-Replay: true`).
  - "processing" durumu → 429 (paralel istek).
  - 5xx response → cache silinir (retry mümkün).
- **MongoDB TTL index** `idempotency_keys.created_at expireAfterSeconds=3600` — 1 saat sonra otomatik silinir.
- **Frontend axios interceptor** (`App.js`): Her POST/PUT/PATCH/DELETE'e `crypto.randomUUID()` ile key atar.

### Test
- 5 aynı key ile POST → backend'de **1 iş** oluştu (4 tanesi cached replay) ✅

## Apple Push Notification (PWA Web Push) — 20 May 2026

### Eklenenler
- **iOS PWA tespit utility** `/app/frontend/src/utils/iosPwa.js`:
  - `isIOS()`, `isStandalone()`, `getIOSVersion()`, `iosSupportsWebPush()`, `iosNotificationStatus()`
  - Statüler: `not_ios` | `needs_install` | `version_old` | `ready`
- **IOSInstallGuide bileşeni** `/app/frontend/src/components/IOSInstallGuide.js`:
  - 3 adımlı kurulum kılavuzu modal'ı (Paylaş → Ana Ekrana Ekle → Bildirim Aç)
  - iOS 16.4 altı için ayrı uyarı ekranı (sürüm güncellemesi tavsiyesi)
  - "Neden bu adımlar?" gizlilik açıklaması
- **NotificationButton ortak bileşeni** `/app/frontend/src/components/NotificationButton.js`:
  - Tüm panellerde tek satır JSX ile entegre edilir
  - Bildirim izni durumuna göre 3 ikon: BellRing (kapalı/sarı), Bell (açık/yeşil), BellOff (reddedildi/kırmızı)
  - Tıklayınca iOS Safari (not standalone) ise IOSInstallGuide; aksi halde normal Firebase FCM akışı
  - `onTokenReceived(token)` callback ile her panel kendi user_type'ını backend'e gönderir
- **Entegrasyon:**
  - PlanFlow: `plan-notif-btn` (user_type=plan)
  - ManagementFlow: `mgmt-notif-btn` (user_type=manager)
  - WarehouseFlow: `warehouse-notif-btn` (user_type=warehouse)
  - OperatorFlow: mevcut `enable-notifications` butonu güncellendi (iOS-aware handler + IOSInstallGuide entegrasyonu)

### iOS Akış (kullanıcı deneyimi)
1. Apple kullanıcı bksistem.space'i Safari'de açar
2. Sağ üstteki sarı 🔔 butona tıklar → **3 adımlı rehber modal açılır**
3. Adım 1-2: Paylaş → Ana Ekrana Ekle (PWA standalone yüklenir)
4. Adım 3: Yeni simgeyi açar → **Bildirim Aç** butonu artık çalışır (iOS 16.4+ Web Push)
5. İzin verildi → Firebase FCM token alınır → backend'e kaydedilir → push notification çalışır

### Test
- iPhone Safari simülasyonu (UA spoof + standalone=false) → buton görünür ✅
- Buton tıklanınca IOS guide açıldı ✅
- 3 adım, "Neden bu adımlar?" bilgisi, "Anladım" CTA görüntülendi ✅

### Sınırlamalar (kullanıcıya bildirildi)
- **iOS 16.4 altı** (~%5 saha): Web Push tamamen desteklenmiyor; Apple Developer + native iOS app ile çözülebilir (~$99/yıl + macOS gerekli — şu an mevcut değil)
- Apple, native iOS app olmadan Safari standalone-dışı Web Push'a izin vermiyor — bu Apple kısıtı, atlatılamıyor

