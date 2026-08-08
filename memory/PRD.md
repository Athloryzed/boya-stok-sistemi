# Buse Kagit - Uretim Yonetim Sistemi PRD

## Original Problem Statement

Factory management system for Buse Kagit paper company. Full-stack React + FastAPI + MongoDB PWA with AI assistants, Excel exports, live dashboards, QR codes, drag & drop, and secure JWT/bcrypt authentication.

## 🆕 Merkezi Bildirim Bekçisi — Kullanıcı Başına Tek Bildirim (Jun 2026) — Iteration 52
Sorun: 2-3 role sahip kullanıcılar aynı olay için 2-3 bildirim alıyordu (çoklu kanal fan-out + FCM/WebPush çift gönderim + bayat token birikimi). Çözüm (7/7 backend test geçti):
1. **`services/notification_guard.py`** — `claim_users(event_key, user_ids)`: `notification_receipts` koleksiyonuna atomik upsert (unique index event_key+user_id, TTL 6 saat). Aynı olay aynı kullanıcıya HANGİ kanaldan gelirse gelsin 1 kez gider.
2. **`services/auto_chat.py`** — Tüm notify_* fonksiyonları (bobin, boya, düşük stok, bakım, acil, iş atandı/tamamlandı) çağrı başına tek `event_key` üretir ve `_save_and_broadcast(event_key=...)` üzerinden `send_push_to_users`'a iletir. Eski `push_dedup` set mekanizması kaldırıldı. Sohbet mesajları TÜM kanallara yazılmaya devam eder — sadece push tekilleşir.
3. **FCM + WebPush çapraz dedup** — `complete_job` FCM'i `evt-job_completed-{id}` anahtarıyla önce claim eder; auto_chat web push aynı anahtarı kullandığından FCM alan kullanıcı web push almaz.
4. **`services/notifications.py`** — `send_notification_to_user_types` yeniden yazıldı: token'lar user_id bazında gruplanır, guard claim sonrası kullanıcının TÜM cihazlarına gider (çoklu cihaz OK, seçenek a). Diğer sender'lar (managers/operators/plan/all_workers) buna delege eder, hepsi `event_key` parametresi alır. `send_fcm_notification` geçersiz token'ları (Unregistered/InvalidArgument/SenderIdMismatch) otomatik siler.
5. **`routes/misc.py`** — register-token artık `user_types` array'ine `$addToSet` yapar (çok rollü kullanıcı tüm rollerinden bildirim alır).
6. **`routes/jobs.py`, `shifts.py`, `messages.py`** — Tüm FCM gönderimlerine event_key + tag eklendi (evt-new_job-, evt-shift_started-, evt-shift_end-, evt-machine_msg-).
7. **Frontend `utils/alertDedup.js`** — localStorage tabanlı cross-tab dedup: aynı olay başka bir sekmede/panelde toast gösterildiyse tekrar göstermez.
- Test: `/app/backend/tests/test_notification_dedup.py` (7/7), rapor: `/app/test_reports/iteration_52.json`

## 🆕 Multi-Warehouse (Depo) Assignment System (Feb 28, 2026) — Iteration 45
Implemented complete dual-warehouse tracking for Bobins and Marka/Stok items (12/12 backend tests, 13/13 frontend flows passed):

1. **Backend** — `backend/routes/warehouse_assign.py`:
   - `GET /api/warehouse-summary` — Returns counts for DEPO1/DEPO2/UNASSIGNED (bobin_count, bobin_critical, marka_stok_count, marka_stok_critical). Critical: bobin total_weight_kg<50, marka_stok quantity<10.
   - `POST /api/warehouse-transfer` — Moves a Bobin or Marka/Stok item between warehouses. Body: `{item_type: "bobin"|"marka_stok", item_id, to_warehouse: "DEPO1"|"DEPO2"|""}` (empty = Atanmamış). Returns `{ok, log}`.
   - `GET /api/warehouse-transfers` — Filterable by `item_type` and `warehouse`. Limit param (default 100).
2. **Models** (`backend/models.py`):
   - `Bobin.warehouse` (Optional[str], "DEPO1"|"DEPO2"|None)
   - `Bobin.warehouse_updated_at` (ISO timestamp)
   - `BrandStock.warehouse` + `warehouse_updated_at` (same)
3. **POST endpoints accept warehouse field**:
   - `POST /api/bobins` — `warehouse` body field saves to bobin.warehouse on create.
   - `POST /api/brand-stock` — Same.
4. **Frontend components**:
   - `components/WarehouseBadgePicker.js` — Inline badge picker dropdown (DEPO1/DEPO2/Atanmamış). Dispatches `warehouse:changed` CustomEvent.
   - `components/WarehouseSummaryCard.js` — `compact` (3-col mini cards) + `full` (3 large cards) views. Auto-refreshes on `warehouse:changed`.
   - `components/WarehouseTransferLogDialog.js` — Modal: tip filter, depo filter, free-text search, scrollable log list with FROM→TO badges, by_user, timestamp.
5. **Pages integrated**:
   - `/bobin` (BobinFlow) — Filter row (Hepsi/Depo 1/Depo 2/Atanmamış), compact summary, badge picker in each row, Add-Bobin dialog warehouse selector.
   - `/marka-stok` (MarkaStokFlow) — Same.
   - `/warehouse` (Depo Paneli) — Full summary cards + "Transfer Geçmişi" button → dialog.
   - `/plan` (PlanFlow) — Compact summary + plan-open-transfer-log button.
   - `/management` (ManagementFlow) — Full summary + management-open-transfer-log button.
6. **Schema**:
   - New collection: `warehouse_transfers` (id, item_type, item_id, item_name, from_warehouse, to_warehouse, by_user, at, notes)
   - Indexes: `(item_type, item_id)` and `at desc`.

### Test IDs (canonical reference)
`wh-badge-{bobin|marka_stok}-{id}`, `wh-pick-{DEPO1|DEPO2|UNASSIGNED}-{id}`, `wh-summary-compact`, `wh-summary-full`, `wh-summary-full-{DEPO1|DEPO2|UNASSIGNED}`, `wh-transfer-log-dialog`, `log-row-{id}`, `log-filter-type-{all|bobin|marka_stok}`, `log-filter-wh-{all|DEPO1|DEPO2}`, `log-search-input`, `log-refresh`, `filter-warehouse-{all|DEPO1|DEPO2|UNASSIGNED}`, `marka-filter-warehouse-*`, `add-bobin-warehouse-{none|DEPO1|DEPO2}`, `add-marka-warehouse-*`, `open-transfer-log`, `plan-open-transfer-log`, `management-open-transfer-log`.

---

## Latest Update — Security Hardening Package (Feb 5, 2026) — Iteration 39
Implemented enterprise-grade security in a single sweep (23/24 tests pass):
1. **CSP/Security Headers** — `middleware/security_headers.py` adds HSTS (2y), CSP, X-Frame DENY, nosniff, Referrer-Policy, Permissions-Policy on every API response.
2. **JWT Refresh Tokens** — 30 min access + 7 day refresh. New endpoints `/api/auth/refresh` (rotation + JTI revocation), `/api/auth/logout`, `/api/auth/me`. Frontend axios interceptor auto-refreshes on 401.
3. **PII Encryption** — Fernet symmetric encryption for `users.phone` and `drivers.phone` (`enc:v1:` prefix, decrypted at API boundary). Auto-migration script encrypts existing plaintext on startup. Key at `/app/backend/.pii_key` (move to env `PII_ENCRYPTION_KEY` in prod).
4. **Backup AES-256-GCM Encryption** — Every backup encrypted to `.archive.gz.enc` + SHA-256 checksum + restore dry-run validation. Endpoint `/api/admin/backups/verify/{filename}`. Key at `/app/backend/.backup_key` (move to env `BACKUP_ENCRYPTION_KEY`).
5. **Per-Account Brute-Force Lockout** — 5 failed logins / 15 min → 15 min lock (HTTP 423). Works on user/driver/management/dashboard. Endpoints `/api/admin/lockouts` (list, clear).
6. **2FA Infrastructure** — User model has `totp_enabled`, `totp_secret`, `backup_codes`, `last_login_at` fields. NOT enforced yet (per user request).
7. **Critical Action Alarms** — `services/alarms.py` writes to `audit_alarms` collection on user_create/delete/role_change, driver_create, auth_failed_5x, etc. Endpoints `/api/admin/alarms` (GET, ACK). No SMS/Telegram yet (per user request).
8. **Audit Log Immutability** — SHA-256 hash chain (prev_hash → entry_hash) makes tampering evident. Verify with `/api/admin/audit/verify`. Legacy pre-chain rows tolerated as genesis.
9. **Strict Pydantic Input Validation** — All login/user-create endpoints now use typed request models (`LoginRequest`, `CreateUserRequest`, etc.) with regex constraints on username/phone.
10. **Daily Backup Verification** — Restore dry-run + checksum compare on every backup run; available via `/api/admin/backups/verify/{filename}`.
11. **MongoDB Auth** — SKIPPED per user request.

### New Endpoints (Security)
- `POST /api/auth/refresh` (rotated refresh token)
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `GET /api/admin/audit/verify` (yonetim only)
- `GET /api/admin/alarms`, `POST /api/admin/alarms/{id}/ack`
- `GET /api/admin/lockouts`, `DELETE /api/admin/lockouts/{account}`
- `GET /api/admin/security/status`
- `POST /api/admin/backups/verify/{filename}`

### Security Dashboard UI (Feb 5, 2026)
- New `/app/frontend/src/components/SecurityDashboard.js` widget mounted as a "Güvenlik" tab in `/management`.
- Live stats (audit chain, unack alarms, lockouts, failed attempts) refresh every 30s.
- Inline actions: "Audit Doğrula" (chain check), "Kilidi Kaldır" per lockout, "Onayla" per alarm.

### Operator Change on Active Jobs (Feb 5, 2026)
- New endpoint `PUT /api/jobs/{job_id}/change-operator` — Yönetim panelinden aktif/duraklatılmış işin operatörü değiştirilebilir.
- Modal: önceki operatörün ürettiği koli (opsiyonel) + kayıtlı operatör seçimi + serbest yazım + not.
- Önceki operatöre kısmi üretim kredisi `shift_end_reports` koleksiyonuna `is_partial:true` ile yazılır → Analiz panelindeki `operator_breakdown` doğru kişiye yansır.
- `transfer_history` array'i job belgesinde her değişimi kaydeder (audit + alarm + websocket broadcast).
- Analytics fix: `routes/analytics.py` `daily-detail` artık aynı gün tamamlanan işlerde eski operatör/yeni operatör payını ayırıyor (çift kredi sorunu engellendi).

### Unified Home Login & Role-Based Access Control (Feb 7, 2026)
- **Tek giriş noktası**: Anasayfada (`/`) merkezi giriş kartı (`components/UnifiedLogin.js`) — kullanıcı adı + şifre + Beni Hatırla + Canlı Pano (TV) alt linki.
- Atatürk + Türk Bayrağı + 23 Nisan teması korunur. Glass-morphism + framer-motion animasyonlar.
- **Rol bazlı landing**: Login sonrası rolün varsayılan paneline yönlendirilir (yonetim → /management, plan → /plan, operator → /operator, sofor → /driver).
- **Auth lib** (`lib/auth.js`): `saveSession`, `getSession`, `isSessionValid`, `canAccessRoute`, `clearSession`, `getRememberedUsername`, `ROUTE_ROLES` haritası.
- **24h politikası**: `remember_me=false` ise 24 saat sonra session geçersiz; `remember_me=true` ise refresh token süresine kadar (7 gün) geçerli, username localStorage'a kaydedilir.
- **ProtectedRoute** (`components/ProtectedRoute.js`): App.js'te tüm panel route'larını sarar. Geçersiz session veya yetersiz rolde anasayfaya redirect + toast.
- **Geriye dönük uyumluluk**: `saveSession` aynı verileri eski panel-bazlı session anahtarlarına da yazar → mevcut panel akışları değişmeden çalışır.
- **Rol erişim haritası** (ROUTE_ROLES):
  - `/management`: yonetim
  - `/operator`: yonetim, operator
  - `/plan`: yonetim, plan
  - `/warehouse`, `/paint`, `/bobin`, `/marka-stok`: yonetim, plan, depo
  - `/driver`: yonetim, plan, sofor
- **Plan kullanıcısı**: Geri tuşuyla anasayfaya dönerse sadece erişebileceği panelleri görür (Yönetim hariç).

### UserMenu + TV Login Bug Fix (Feb 7, 2026)
- **Bug fix**: Canlı Pano şifresi yazıldıktan sonra tekrar şifre sormuyor — `UnifiedLogin.handleTvLogin` artık LiveDashboard'ın okuduğu `sessionStorage` anahtarına yazıyor.
- **UserMenu component** (`components/UserMenu.js`): Sağ üst köşede avatar + dropdown. Header: avatar (baş harfi + hash-renkli gradient), display_name, roller, giriş tarihi/saati, Beni Hatırla badge'i. Dropdown: erişilebilir tüm paneller 2 sütunlu grid (mevcut sayfa highlighted), Anasayfa shortcut, Çıkış Yap.
- **Entegrasyon**: ManagementFlow, OperatorFlow, PlanFlow, WarehouseFlow, PaintFlow, BobinFlow, DriverFlow, MarkaStokFlow — hepsinin header'ında theme-toggle yanına eklendi.
- **Auth uyumluluk düzeltmesi**: `saveSession` artık panel session keylerine `login_time` ve `expiry` alanlarını da yazıyor; `management_session` ayrıca yazılıyor → tüm panellerin mevcut 24h auth check'leri merkezi session ile uyumlu çalışıyor.
- ManagementFlow auth check `app_session`'a düştü → Yönetim girişinden sonra `/management` direkt açılır.
- `clearSession` artık dashboard_token (sessionStorage), management_session ve tüm panel anahtarlarını temizler.

### Job Timeline & Operator Chain Badge (Feb 5, 2026)
- Aktif iş kartında operatör değişimi varsa **"N değişim"** mor rozeti gösterilir (`data-testid="operator-history-badge-{jobId}"`).
- Rozete tıklanınca **İş Hikayesi** modal'ı açılır: zaman sıralı tüm olaylar (başlatma, makine transferi, operatör değişimleri) + **Operatör Zinciri** özeti (ör. `Ali(0→25) → Mehmet(25→60) → Ahmet(60→100)`) + şu anki durum kartı.
- Tek koleksiyon kullanılır: `jobs.transfer_history`. Geriye dönük uyumlu (eski makine-transfer kayıtları da timeline'da farklı ikonla görünür).

### Job Thumbnails & Operator Chain Report (Feb 5, 2026)
- **Backend**: `services/image_utils.create_thumb_data_url` Pillow ile 128x128 JPEG (Q70) thumb üretir (~3-8 KB/iş). `Job` modelinde `thumb_url` alanı eklendi. `create_job` + `update_job` (image_url değiştiğinde) otomatik thumb üretir. Startup'ta `backfill_job_thumbnails` mevcut image'ları olan işler için thumb hazırlar. `GET /api/jobs` artık `thumb_url`'ü liste yanıtında döner.
- **Frontend**: Yeniden kullanılabilir `components/JobThumb.js` bileşeni — tüm panellerde (Operatör, Yönetim, Plan, Depo) iş kartlarında 40-96px arası küçük önizleme. Tıklanınca mevcut full-image preview modal'ı açılır (önce thumb gösterir, arka planda tam görsel çekilir).
- Bug fix: PlanFlow ImagePreview Dialog `data:` URL src kontrolü eksikti — düzeltildi.
- **Excel Operatör Zinciri Sayfası**: `GET /api/analytics/export` artık 5. sayfa olarak "Operator Zinciri" üretir. Operatör değişimi yapılmış tüm tamamlanmış işler için: Tarih · İş Adı · Makine · Toplam Koli · Değişim Sayısı · Zincir (`Ali(0→25) → Mehmet(25→60) → Ahmet(60→100)`) · Notlar.
- **Operator Performansı çift kredi fix**: Excel sayfa 3 ve `/api/analytics/daily-detail` artık `shift_end_reports.is_partial` kayıtlarını kullanarak eski operatöre kısmi koli kredisi, yeni operatöre yalnızca kalan farkı verir.
- **Yönetim Onay Bekleyen**: kısmi raporlar artık "operatör → yeni operatör" mor rozetiyle gösteriliyor (`data-testid="report-transferred-{id}"`).

### New Indexes
- `login_attempts.created_at` (TTL 24h), `(account, created_at)`
- `account_lockouts.locked_until`
- `audit_logs.created_at`
- `audit_alarms.created_at`, `(acknowledged, severity)`
- `revoked_tokens.expires_at` (TTL 0)

## Architecture (Post-Refactoring & Security Hardening - Feb 2026)

### Backend Structure
```
/app/backend/
├── server.py              # Main app - FastAPI setup, routers, WebSockets, startup, CORS, security middleware
├── database.py            # MongoDB connection (client, db)
├── auth.py                # JWT (access 30m + refresh 7d) + bcrypt helpers
├── models.py              # All Pydantic models (User now has totp_* + last_login_at)
├── websocket_manager.py
├── middleware/
│   ├── idempotency.py     # Idempotency-Key middleware
│   └── security_headers.py # HSTS / CSP / XFO / nosniff / Referrer / Permissions
├── services/
│   ├── audit.py           # Hash-chained append-only audit log
│   ├── alarms.py          # audit_alarms writer (critical action alarms)
│   ├── account_lockout.py # 5x → 15min lockout
│   ├── crypto_utils.py    # Fernet PII encryption (encrypt_pii/decrypt_pii)
│   ├── backup_crypto.py   # AES-256-GCM backup encrypt + checksum + dry-run
│   ├── validators.py      # Strict Pydantic request models
│   └── notifications.py   # Firebase FCM, Twilio WhatsApp
├── routes/
│   ├── health.py
│   ├── auth_refresh.py    # /auth/refresh, /auth/logout, /auth/me
│   ├── security_admin.py  # /admin/audit/verify, /admin/alarms, /admin/lockouts, /admin/security/status
│   ├── machines.py
│   ├── jobs.py
│   ├── shifts.py
│   ├── defects.py
│   ├── analytics.py
│   ├── users.py           # Updated: lockout + validators + PII encryption + alarms
│   ├── warehouse.py
│   ├── paints.py
│   ├── ai.py
│   ├── dashboard.py       # Updated: lockout + token pair
│   ├── messages.py
│   ├── visitors.py
│   ├── operators.py
│   ├── pallets.py
│   ├── logistics.py       # Updated: driver login lockout + PII encryption
│   ├── backups.py         # Updated: AES-256-GCM + checksum + dry-run verify endpoint
│   └── misc.py
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



## Global Onay (Confirmation) Sistemi — 20 May 2026

### Çözüm
**ConfirmProvider + useConfirm hook** — App.js root'una sarıldı, tüm panellerden tek satırla çağrılır.
- 3 variant: default (mavi), warning (amber), destructive (kırmızı)
- Klavye: Enter=onay, Esc=iptal, dış tıklama=iptal
- Detay kutusu (opsiyonel context bilgisi)

### Onaya Bağlanan Aksiyonlar (panel başına)
- **Operator**: İşi Tamamla (warning), İşi Başlat (default)
- **Plan**: İşi Sil (destructive), Hızlı Aktar (warning), Geçmiş İş Sil (destructive)
- **Yönetim**: Rapor Onayla (warning), Tümünü Onayla & Vardiya Bitir (destructive), Kullanıcı Sil, İş Sil, Menü Sil, Yedek Sil, Bobin Yeniden Hesapla
- **Depo**: Talep Tamamla (warning)
- **Bobin**: Satış (warning), Makineye Ver (warning)

### Eski `window.confirm` temizlendi
Tüm yerli browser dialog'lar yeni hook'a yükseltildi → tutarlı UI + dark mode.

### Test
- Bobin Yeniden Hesapla → modal açıldı, başlık + açıklama + detay + 2 buton göründü ✅
- Vazgeç → dialog kapandı, işlem yapılmadı ✅

## 2 Bug Fix — Çoklu Bildirim + Marka/Koli Detay Modal Pozisyonu — 20 May 2026

### Bug A: Aynı bildirim 2-3 kez geliyordu
**Sebep:** Backend FCM zaten OS-level push gönderiyordu, ek olarak frontend WebSocket event'i alıp `new Notification(...)` / `showNotification(...)` çağırıyordu → çakışma.

**Düzeltme:**
- `ManagementFlow.js` — WebSocket `job_completed` handler'ındaki `new Notification("İş Tamamlandı!", ...)` çağrısı KALDIRILDI
- `OperatorFlow.js` — 3 yerdeki `showNotification(...)` çağrıları kaldırıldı:
  - Yeni mesaj bildirimi (2 yer)
  - Vardiya sonu bildirimi (1 yer)
- Artık tek kanal: backend FCM push → OS-level bildirim + foreground'da `onMessageListener` → toast.success
- WebSocket event'leri sadece UI güncelleme + in-app toast/banner için kullanılıyor

## Birleşik Giriş — Tekrar Şifre Sorma Bug Fix (11 Haz 2026)

### Sorun
Ana sayfada (UnifiedLogin) bir kez giriş yapılmasına rağmen, zaman içinde paneller (Bobin, Depo, Plan, Marka/Stok, Boya, Operatör) kullanıcıdan tekrar şifre istiyordu.

### Kök Sebep
Her panel kendi `*_session` (bobin_session, depo_session, plan_session, marka_stok_session, paint_session, operator_session) anahtarına bakıyor ve **sabit 24 saat** `login_time` kontrolü uyguluyordu — merkezi `app_session`'ı ve "Beni Hatırla" (7 gün) politikasını yok sayıyordu. 24 saat dolunca veya panel anahtarı temizlenince/eviction olunca panel kendi giriş formuna düşüyordu. Ayrıca PaintFlow giriş formu `/management/login` (yönetim şifresi) gerektiriyordu → depo/plan kullanıcısı giremiyordu.

### Çözüm (frontend-only, veri kaybı yok)
- `lib/auth.js` → yeni `resumeCentralSession(routePath)`: merkezi oturum geçerli (isSessionValid: remember_me/24h) ve role route erişimi varsa (canAccessRoute) normalize kullanıcı verisi döner; `auth_token` yoksa merkezi token'ı yazar (taze token'ı ezmez).
- Tüm paneller (Bobin, Warehouse, Plan, MarkaStok, Paint, Operator) session useEffect'i artık ÖNCE merkezi oturumdan hidratlanıyor; eski panel-key kontrolü yalnızca geriye dönük fallback. → Rolün eriştiği paneller bir daha şifre sormuyor.
- Operatör özel: merkezi oturumdan hidratlanır, makine seçimi panel session'da varsa korunur (step 3), yoksa makine seçim adımına (step 2) geçer — şifre sorulmaz.
- Panel `handleLogout`'ları artık `clearSession()` (merkezi) çağırıp ana sayfaya yönlendiriyor → çıkış gerçekten çıkış yapıyor.
- `App.js` axios interceptor: refresh token reddedilince (gerçek expiry) `clearSession()` ile tüm oturum temizleniyor.

### Doğrulama (e2e screenshot)
- depo1 ile ana sayfadan giriş → tüm panel-key'ler silindi (24h/eviction simülasyonu) → /bobin, /marka-stok, /warehouse, /paint hepsi ŞİFRESİZ açıldı ✅ (Paint artık yönetim şifresi istemiyor).
- ali (operator) ile giriş → /operator şifresiz makine seçim ekranı; /management'a gidince ana sayfaya redirect (RBAC korundu) ✅

### Bug B: Marka/Koli detay drawer'ı sayfanın altında açılıyor
**Sebep:** `MarkaStokFlow.js`'de detay drawer'ı `flex items-end md:items-center` ile mobil için bottom-sheet tasarımındaydı. Pek çok ekranda ekranın altına denk geliyordu.

**Düzeltme:**
- Hem **Marka sekmesindeki** hem **Koli sekmesindeki** detay drawer'ı **merkezi modal**'a dönüştürüldü
- `fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm`
- Yumuşak spring animasyonu (scale + y) ile açılıp kapanır
- Bobin drawer'ının z-index'i 50 → 9999'a yükseltildi (Confirm dialog + toaster üstüne gelmemesi için)

### Test
- Marka Stok > "Deniz 33" kartına tıkla → ekran merkezinde detay modal açıldı, satış/giriş hareketleri görünür ✅


---

## Oturum: UI Tasarım Yenilemesi v3 (11 Haziran 2026)

**Kullanıcı isteği:** Anasayfa dahil tüm UI'nın modernize edilmesi (Atatürk resmi + Türk Bayrağı korunarak), hiçbir işlevsellik bozulmadan; yüksek animasyon yoğunluğu, mevcut amber/çelik renk kimliği rafine edilerek. Mobil + PC tam destek.

### Yapılanlar (yalnızca CSS/className — sıfır mantık değişikliği)
- **App.css v3 bölümü:** `.ambient-layer` (tüm panellerde süzülen ışık küreleri, lite-mode + light temada kapalı), `icon-tile-glow` (nefes alan parıltı), `text-gradient-gold` / `text-gradient-custom` (akan gradyan başlıklar), `shine-sweep` (buton ışık süpürmesi), `float-soft`, `login-glow`, `tv-bg` + `tv-stat` (Canlı Pano kartları), `bento-card`, header alt çizgisi akan ışık hattı (`borderFlow`), kart derinliği (`.rounded-xl.bg-surface` iç ışık). `prefers-reduced-motion` ve `.lite-mode` ile tüm yeni efektler kapanır.
- **App.js:** Köke `ambient-layer` div eklendi (pointer-events:none, z-0 — tıklamaları engellemediği test edildi).
- **Home.js:** Modül ızgarası asimetrik **bento grid**'e dönüştürüldü (Yönetim + Canlı Pano 2 sütun kaplar, ikon karoları, hover ok/parıltı). Tüm data-testid'ler korundu.
- **UnifiedLogin.js:** login-glow nefes efekti, süzülen logo, shine-sweep giriş butonu.
- **LiveDashboard.js:** TV restyle — altın gradyan başlık, büyük metric-display sayılar, tv-stat renk-aksanlı kartlar, çalışan makinelerde nefes alan yeşil çerçeve, 1. sıradaki operatöre altın podyum.
- **TrackingPage.js:** müşteri sayfası — animasyonlu ikon karo + panel-industrial kart.
- **Panel başlıkları:** Management/Operator/Plan logo karolarına glow; Warehouse, Paint, Driver başlıkları ikon karo + gradyan metinle yenilendi; Bobin/MarkaStok karolarına glow.
- **Eski (legacy) giriş ekranları:** panel-industrial + login-glow karta dönüştürüldü.
- **dialog.jsx:** overlay'e backdrop-blur eklendi.

### Test (iteration_41.json — %100 başarı)
- 12 senaryo doğrulandı: Atatürk+bayrak korunmuş, unified login, bento navigasyon + RBAC filtreleme, tüm paneller (Operator/Plan/Depo/Bobin/MarkaStok/Canlı Pano) yükleniyor, sekmeler/dialoglar/çıkış çalışıyor, mobil (390px) taşma yok.

### Backlog notları
- (P3, mevcut durum) Plan "Yeni İş" dialogundaki tarih alanı native date input — shadcn Calendar'a geçirilebilir.
- /management'taki legacy şifre ekranı artık görünmüyor (tasarım gereği: yönetim girişi anasayfa unified login'den). Yönetim rollü bir test kullanıcısı test_credentials.md'ye eklenebilir.

---

## Oturum Devamı: Dinamik Hava Durumu Arka Planı (11 Haziran 2026)

**Kullanıcı isteği:** Anasayfa arka planı İstanbul'un anlık hava durumuna göre şekillensin; saatlik güncellensin; animasyonlu sahneler olsun (Atatürk + Türk Bayrağı korunarak).

### Yapılanlar
- **Backend:** `routes/weather.py` → `GET /api/weather/istanbul` (auth gerekmez, anasayfa login öncesi de çağrılır). Open-Meteo ücretsiz API proxy'si (API anahtarı GEREKMEZ), 30 dk bellek içi önbellek, sağlayıcı hatasında son bilinen veri (stale=true). Veri: temperature_c, weather_code (WMO), is_day, wind_speed_kmh.
- **Home.js:** WMO kodu → sahne kategorisi (clear/partly/cloudy/fog/rain/snow/thunder). Her kategori için:
  - Gökyüzü gradyanı değişir (yağmur=gri, kar=beyaz-mavi, fırtına=koyu, sis=gri)
  - YAĞMUR: 38 düşen damla (rüzgâr >30 km/s ise eğik), koyu bulutlar, güneş gizli
  - KAR: 30 salınan kar tanesi + zemin beyaza döner, çiçekler gizlenir
  - FIRTINA: yağmur + periyodik tam ekran şimşek parlaması + parlayan şimşek oku
  - SİS: 3 süzülen bulanık sis bandı, güneş gizli
  - KAPALI: 7 bulut + soluk güneş; yıldızlar yalnız açık gecelerde
  - Kelebek/yaprak animasyonları yalnız sakin havada
- **Hava rozeti:** Saat altında `[ikon] 20°C · Açık · İstanbul` (data-testid="weather-chip"), rüzgârlıysa 💨 hız gösterir.
- **Önizleme:** `/?hava=rain|snow|thunder|fog|cloudy|partly|clear` ile tüm sahneler manuel test edilebilir.
- **Lite mod + prefers-reduced-motion:** tüm hava efektleri kapanır.

### Test
- Backend curl: gerçek veri + 30 dk önbellek doğrulandı.
- Screenshot: thunder/snow/fog/clear sahneleri ?hava= parametresiyle görsel doğrulandı; rain/snow/thunder/fog katman testid'leri DOM'da mevcut.
- Bug düzeltildi: güneş/ay bloğu koşul sarmalayıcısının açılışı uygulanmamıştı → ekranda ")}"" metni görünüyordu; düzeltildi ve doğrulandı.

### Not
- Open-Meteo verisi CC BY 4.0 — ticari olmayan kullanımda günde ~10.000 çağrı limiti var; 30 dk önbellekle günde en fazla ~48 çağrı yapılır.


---

## Oturum Devamı: Premium Bento UI v4 — Anasayfa + Tüm Paneller (14 Şubat 2026)

**Kullanıcı isteği:**
Anasayfa ve panel ekranlarının UI/UX, animasyon ve erişilebilirlik açısından komple yenilenmesi. Atatürk resmi asla silinmeyecek + Türkçe karakter/imla desteği güçlendirilecek.

**Kullanıcı tercihleri:**
- Tasarım: "Premium Endüstriyel" + "Bento Grid Modern" (sıcak amber/altın aksanlı, modüler kartlar)
- Animasyon yoğunluğu: **Yüksek**
- Mobil deneyim: Mobil-öncelikli + Eşit öncelikli
- Erişilebilirlik (a11y): **Tam (WCAG AAA)**
- Atatürk/Bayrak: Mevcut konum + daha şık altın çerçeve + minimal sunum
- Türkçe karakter düzeltmesi: **Tüm UI'da uygulansın**

### Yapılanlar

**1. CSS v4 — Premium Bento Design System** (`App.css` lines 1160+)
- `.skip-to-main` (WCAG skip-to-content linki — sarı amber, klavye Tab ile odaklanır)
- `.sr-only-aaa` (yalnızca ekran okuyucular için utility)
- `@media (prefers-contrast: more)` — yüksek kontrast modu
- Güçlendirilmiş `*:focus-visible` (3px amber outline + 5px ring)
- `.bento-card-premium` — koyu altın gradient + glassmorphism v2 + hover lift, light theme variant
- `.ataturk-frame-premium` — **resim sabit, sadece çerçeve döner** (conic gradient, 16s lineer rotate + 4s breathe glow)
- `.chip-premium`, `.weather-chip-premium` — premium hava/saat chip'leri
- `.header-premium`, `::after` flowing border-animation (8s)
- `.panel-logo-tile` — renkli logo karoları (B/P/O vb. her panel için)
- `.title-gradient-premium` — altın gradient shine animation
- `.btn-premium-gold` — premium altın butonlar
- `.bento-icon-tile`, `.bento-arrow-premium`, `.input-premium`, `.toggle-premium-track`
- `.bottom-nav-premium` (mobil-only)
- Tüm animasyonlar `lite-mode` + `prefers-reduced-motion` ile devre dışı bırakılır.

**2. Home.js — Premium Bento Grid v2**
- Atatürk: yeni premium altın çerçeve (sabit Atatürk resmi + dönen gradient halo). aria-label="Mustafa Kemal Atatürk", role="img", img alt korunur.
- "BUSE KÂĞIT" başlığı `title-gradient-premium` ile altın gradient shine.
- "Üretim Yönetim Sistemi" alt başlık.
- Hava chip premium (`weather-chip-premium`) — gece/fırtınalı havada premium, gündüz/açık havada light.
- `isDarkBg` türevi: isNight VEYA wcat in [thunder/rain/fog/cloudy] — başlık + chip + welcome bar styling.
- **Bento Grid v2**: Yönetim Paneli + Canlı Pano `col-span-2` featured kart. Diğer modüller kompakt kart. Her kartta:
  - Renkli `bento-icon-tile` (rgb türetilmiş gradient + nefes alan glow)
  - Türkçe modül adı + açıklama (text-amber-50 / text-amber-200/80)
  - Hover'da görünen `bento-arrow-premium` (ok)
- `<nav aria-label="Panel modülleri">` semantik sarmalayıcı.
- Welcome bar `role="status" aria-live="polite"` ile screen reader destekli.

**3. UnifiedLogin.js**
- autoFocus kaldırıldı → klavye sıralı erişim Tab ile skip-link'ten başlar.
- `role="form" aria-labelledby` semantik form yapısı.
- `aria-required`, `aria-invalid`, `aria-busy`, `aria-pressed` (göster/gizle).
- Hata mesajı `role="alert" aria-live="assertive"`.
- `sr-only-aaa` label'lar her input için.
- `aria-label`'lar (şifre göster/gizle, TV girişini aç).
- Premium altın login kartı (`border-amber-500/30 + login-glow`), shield ikonlu altın gradient logo karosu, `Buse Kâğıt` başlık (Türkçe karakter düzgün).
- `btn-premium-gold` ile Giriş Yap.
- Yanıltıcı "Beni Hatırla" toggle artık `peer-focus:ring` ile klavye odağında.

**4. LiveDashboard.js**
- "BUSE KÂĞIT" başlık → `title-gradient-premium` altın shine.
- "Canlı Üretim Panosu" alt başlık.
- 4 metric kartı Türkçe büyük harf: **ÇALIŞAN MAKİNE, BUGÜN ÜRETİM, BEKLEYEN İŞ, TAMAMLANAN** (CSS uppercase yerine doğrudan büyük harf yazıldı — Türkçe 'İ' düzgün görünüyor).
- "MAKİNE DURUMLARI", "GÜNÜN EN İYİLERİ", "SON 7 GÜN" alt başlıklar.
- Makine durumları: **Çalışıyor / Bakımda / Boşta** (statusText helper).
- "Canlı — 15 saniyede bir güncellenir" alt etiket.

**5. Panel Header'ları**
- **ManagementFlow**: amber "B" panel-logo-tile + "Buse Kâğıt" üst etiket + "Yönetim Paneli" başlık (font-black tracking-tight).
- **OperatorFlow**: yeşil "O" panel-logo-tile + "Operatör" üst etiket + makine adı başlık.
- **PlanFlow**: mavi "P" panel-logo-tile + "Buse Kâğıt" üst etiket + "Planlama Paneli" başlık.
- **BobinFlow**: login form Türkçeleştirildi (Kullanıcı adı, Şifre, Beni hatırla, Giriş Yap, Bobin Yönetimi).
- WarehouseFlow / MarkaStokFlow / PaintFlow / DriverFlow zaten Türkçe karakterli + gradient başlıklı (değişiklik gerekmedi).

**6. App.js**
- Sayfa başında `<a href="#main-content" className="skip-to-main">İçeriğe atla</a>` skip link.
- Home.js'de `<div id="main-content">` ana içerik wrapper.
- `index.html` lang="tr" olarak ayarlandı (ekran okuyucu Türkçe ses.

**7. test_credentials.md**
- Yönetim test kullanıcısı eklendi: `adminusr / admin123` (yonetim rolü, is_active=true yapıldı).

### Test
- `/app/test_reports/iteration_42.json` — testing_agent_v3_fork tarafından **11/13 spec doğrulandı**, **0 fonksiyonel regresyon**, 3 minor polish item (skip-link tab erişimi, Atatürk aria-label, LiveDashboard 'I' karakteri) — **TÜMÜ DÜZELTİLDİ** ve manuel screenshot ile doğrulandı.
- Screenshot doğrulamaları: Home (light/dark/thunder), Quick FAB sheet, Management panel, Plan panel, UnifiedLogin (focus state skip link visible).

### Korunan ögeler
- Atatürk resmi (sol üst) + Türk Bayrağı (sağ üst)
- Tüm data-testid attribute'ları (ASCII)
- Tüm API endpoint'leri ve veri akışı (sıfır backend değişikliği)
- 23 Nisan teması (Nisan ayına özel)
- Open-Meteo hava entegrasyonu
- Yönetim Hızlı Panel FAB + sheet
- prefers-reduced-motion + lite-mode düşürme

### Türkçe karakter düzeltmeleri (örnekler)
- Yonetim → Yönetim
- Operator → Operatör (modül kartı + UserMenu rol etiketi)
- Surucu → Sürücü
- BUSE KAGIT → BUSE KÂĞIT
- Buse Kagit → Buse Kâğıt
- Canli Pano → Canlı Pano
- Uretim → Üretim
- Sifre → Şifre
- Kullanici adi → Kullanıcı adı
- Bobin Yonetimi → Bobin Yönetimi
- Iyileri → İyileri (LiveDashboard)
- Is planlama → İş planlama
- Bekleyen Is → Bekleyen İş
- Calisiyor → Çalışıyor
- Bakimda → Bakımda
- Bosta → Boşta


---

## Oturum Devamı: Messenger v1 + Akıllı Bildirimler (14 Şubat 2026)

**Kullanıcı isteği:**
"Bildirimleri zenginleştirip kullanıcılar arası messenger benzeri özellik. Operatör 'bobin istiyorum' dediğinde depocular otomatik mesaj alsın."

**Kullanıcı tercihleri (maksimum kapsam):**
- 1c: 1:1 DM + grup kanalları + makine kanalları
- 2f: Tüm otomatik tetikleyiciler (bobin/boya/düşük stok/yeni iş/iş tamamlandı)
- 3: Dahili + Tarayıcı (Web Push)
- 4c: Metin + emoji + şablonlar + dosya/foto
- 5c: Okundu + yazıyor + son görülme
- 6a: Sınırsız mesaj geçmişi

### Backend (Yeni)
- **models_chat.py**: Conversation (dm/group/machine), ChatMessage (text/system/auto_event/file/image), MessageRead, UserPresence, PushSubscription. 6 SEED_CHANNELS (#genel, #yonetim, #plan, #operator, #depo, #sofor) + 6 QUICK_TEMPLATES.
- **routes/chat.py** (~470 satır): 16 endpoint (conversations, messages, read, typing, dm, users, templates, reaction, upload, push-subscribe, unread-total, groups, presence).
- **services/auto_chat.py**: notify_bobin_request, notify_paint_request, notify_low_stock, notify_job_assigned, notify_job_completed + ensure_seed_channels + ensure_machine_channel.
- **services/web_push.py**: VAPID anahtar otomatik üretim + pywebpush ile gönderim. .vapid_private.pem (0600) + .vapid_public.txt
- **websocket_chat.py**: ChatConnectionManager (user_id→set(WebSocket) çoklu cihaz + presence broadcast). Event tipleri: new_message, typing_start/stop, presence_update, message_read, reaction_added, conversation_update.
- **server.py**: /api/ws/chat?token=JWT WebSocket endpoint + seed_chat_channels startup event (6 grup + her makine için bir kanal).
- **Auto-trigger entegrasyonu**: warehouse-requests (Bobin→bobin_request, Boya→paint_request), jobs.py POST→job_assigned, jobs.py complete→job_completed, paints.py movement→low_stock.
- **MongoDB indexes**: conversations, chat_messages, message_reads, push_subscriptions için optimize indexler.
- **Yeni pip**: pywebpush==2.0.0 + py-vapid==1.9.4 + cryptography==46.0.3

### Frontend (Yeni)
- **lib/messenger.js**: chatApi REST + connectChatWS (auto-reconnect 3s, 25s heartbeat) + ensurePushSubscription (VAPID).
- **components/messenger/MessengerPanel.jsx** (~700 satır): Drawer ana bileşeni. Global FAB sol altta + unread badge, soldan sliding drawer (motion spring), 4 filter chip, "Yeni konuşma başlat", arama, conversation kartları (icon + isim + preview + unread badge + online dot), mesaj balonları (kendi sağda altın, başkaları solda gri, sistem ortada altın), avatar + rol + zaman + ✓✓, reactions, typing indicator, InputBar (Enter gönder + emoji + şablon + dosya butonu).
- **components/messenger/GlobalMessenger.jsx**: App.js wrapper, oturum kontrol + path filter (/dashboard ve /takip/* hariç).
- **App.js**: GlobalMessenger import + render.
- **public/sw.js**: Service Worker push event handler JSON payload + notificationclick.
- **lib/auth.js**: saveSession user_id JWT'den decode + getSession backward compat.

### Otomatik akış örneği (Operatör Bobin İster)
1. Operatör panelinde "Bobin İstiyorum" → POST /api/warehouse-requests
2. Backend notify_bobin_request çağrılır:
   - #depo kanalına auto_event mesaj eklenir (event_type='bobin_request')
   - WebSocket: tüm depocu kullanıcılara new_message broadcast
   - Offline depocular için Web Push gönderilir
3. Depocu drawer'ında badge görünür + toast + (izin verdiyse) tarayıcı bildirimi.
4. Cevap: drawer aç + şablona bas: "📜 Bobin gönder"

### Test
- /app/test_reports/iteration_43.json: 19/19 backend pytest + 16/16 frontend data-testid PASS, sıfır kritik/minor sorun.
- /app/backend/tests/test_chat_messenger.py — regresyon için kalıcı pytest dosyası.
- Test edilmedi (Faz 2/manuel): 2 tarayıcı real-time typing/read, Web Push tam delivery, job_assigned/completed E2E (kod var, payload edge case'leri test edilmedi).

### Korunan
- Mevcut /api/messages (eski makine mesajları) — geriye uyumluluk.
- Tüm UI v4 stilleri (premium-bento + Türkçe).
- Atatürk premium çerçeve + tüm data-testid'ler.

### Çalışmayan / Eksik (Faz 2)
- Sesli mesaj
- Mesaj arama (içerik bazlı)
- Mesaj düzenleme/silme UI (backend soft-delete hazır)
- WhatsApp köprüsü (Twilio key gerekir)

---

## Oturum Devamı: Messenger Plus 3 İyileştirme (14 Şubat 2026)

**Kullanıcı isteği:** "Önerdiğin iyileştirmeyi de yapalım."
(önerilen 3 madde tamamı onaylandı.)

### A) Operatör Hızlı Talep FAB (sağ alt)
- **OperatorQuickRequest.jsx** (~300 satır) — Sağ alt kırmızı/altın gradient FAB (sol altta Messenger FAB ile çakışmaz)
- Tek dokunuşla 4 talep türü:
  - **📦 Bobin İste**: Hızlı miktarlar (3/5/10/20) + özel miktar input
  - **🎨 Boya İste**: 12 renk seçici (Beyaz, Siyah, Mavi, Lacivert, Refleks, Kırmızı, Magenta, Rhodam, Sarı, Gold, Gümüş, Pasta) + L input
  - **🔧 Bakım Talep Et**: Açıklama textarea → #yonetim + #plan + makine kanalına otomatik mesaj
  - **🆘 ACİL YARDIM** (animate-pulse): Açıklama → TÜM kanallara (#yonetim, #plan, #operator, #depo, makine) yüksek öncelikli mesaj + Web Push
- OperatorFlow `selectedMachine && step >= 2` koşuluyla render

### B) Messenger Sık Erişim (Hızlı Erişim avatar şeridi)
- **MessengerPanel ListView** üst kısmında yatay scroll 6 avatar
- **Backend: `GET /api/chat/suggested-users?limit=6`**
  - Algoritma: (1) Son DM ortakları (recency öncelikli), (2) Rol bazlı eşleştirme, (3) Online'lar öne
  - Rol haritası: operator → depo+plan+sofor / plan → operator+yonetim / depo → operator+sofor+yonetim / sofor → depo+plan / yonetim → tüm aktifler
- Her avatar: renkli gradient (rol bazlı), online dot (yeşil/gri), recent badge (amber), tek tıkla DM açar

### C) Yönetim Bildirim Yönetimi (modal)
- **NotificationSettings.jsx** (~230 satır) — ManagementFlow header'da "🔔 Bildirimler" buton ile açılır
- **Backend: `GET/PUT /api/chat/notification-settings`** (PUT sadece yonetim rolünde)
- **MongoDB**: `notification_settings` koleksiyonu, `id="global"`, settings objesi (event_type → { enabled, target_channels, threshold_l })
- **5 olay yönetilebilir**:
  - 📦 Bobin Talebi (aç/kapa + kanal seç)
  - 🎨 Boya Talebi
  - ⚠️ Düşük Stok Alarmı (eşik L input)
  - 📋 Yeni İş Atandı (Makine Kanalı seçeneği var)
  - ✅ İş Tamamlandı
- **6 kanal seçeneği**: Genel, Yönetim, Plan, Operatör, Depo, Sürücü + Makine (job_assigned için)
- **Kaydet** (PUT) + **Varsayılana Sıfırla** (confirm)
- **auto_chat.py** TÜM 5 tetikleyicide `_is_enabled(event_type)` kontrolü yapar — yönetim devre dışı bırakırsa loglar `"X disabled by settings — skipping"` ve mesaj atmaz
- **`notify_maintenance_request` + `notify_emergency`** ayarlardan **etkilenmez** (operatör başlatır, her zaman çalışır)

### Bonus: Quick-Request endpoint
- **POST /api/chat/quick-request** (kind=bobin|paint|maintenance|emergency)
- Bobin/paint için warehouse_requests koleksiyonuna da kayıt atar (geriye uyumluluk)
- Doğrudan ilgili notify_* fonksiyonunu çağırır

### Test
- **`/app/test_reports/iteration_44.json`**: Backend 12/12 pytest PASS (%100) + Frontend 55+ data-testid PASS (~95%). Sıfır kritik veya blocking sorun.
- 2 LOW-severity observation (kullanıcı tarafında çalışıyor):
  - Playwright .click(force=true) → notification-settings-btn timing (native click sorunsuz, manuel kullanıcı tıklaması düzgün açar)
  - Save toast Playwright tarafından yakalanmadı (sonner çok hızlı kayboluyor; backend PUT 200 dönüyor, ayarlar kaydediliyor)
- **`/app/backend/tests/test_iteration44_quick_request.py`** — kalıcı regresyon dosyası (12 case)

### Test edilen endpoint kayıtları
- GET /api/chat/suggested-users?limit=6 → 200 (rol+recent+online sıralı)
- GET /api/chat/notification-settings → 200 (5 event + web_push default)
- PUT /api/chat/notification-settings (operator) → 403 (rol guard)
- PUT /api/chat/notification-settings (admin) → 200 (merge)
- POST /api/chat/quick-request kind=bobin → 200 + warehouse-request + #depo auto_event
- POST /api/chat/quick-request kind=paint → 200 + #depo auto_event (color+L)
- POST /api/chat/quick-request kind=maintenance → 200 + #yonetim+#plan+makine auto_event
- POST /api/chat/quick-request kind=emergency → 200 + 4 kanal + makine auto_event
- POST /api/chat/quick-request kind=invalid → 400
- Settings disable round-trip → enabled=false iken auto_event atılmaz (log: "disabled by settings — skipping")

### Korunan
- Tüm önceki messenger akışları (iteration_43)
- Mevcut /api/messages (eski makine mesajları)
- Tüm UI v4 stilleri + Türkçe karakter
- /api/warehouse-requests da auto-trigger çalışıyor (eski operatör akışı bozulmadı)


---

## Oturum Devamı: Yemek Menüsü Premium UI + Haftalık Görünüm + Küçültme (14 Şubat 2026)

**Kullanıcı isteği:** Anasayfadaki yemek menüsünü daha şık ve UI uyumlu yap; diğer günleri gösteren buton ekle; küçültme tuşu ekle.

### Backend
- `/app/backend/routes/menu.py` → yeni endpoint `GET /api/menu/week?days_back=1&days_forward=6` (kamuya açık, login gerekmez). Aralıktaki her gün için kayıt yoksa boş stub döner; `is_today` flag'i bugünü işaretler.

### Frontend (`Home.js`)
- Yemek menüsü kartı eski turuncu/pembe gradyandan, uygulama kimliğiyle uyumlu **çelik-altın premium** tasarıma çevrildi (hem koyu hava hem aydınlık hava varyantı). Amber-500/30 ring + üst altın akan ışık hattı + 2 blob blur.
- **Küçültme tuşu (chevron)** eklendi (`data-testid="menu-collapse-toggle"`). Tıklayınca kart tek satır chip'e iner (ikon + "Bugünkü Menü" + ilk 3 yemek özet). Tercih `localStorage.home_menu_collapsed` ile kalıcı.
- **"Diğer Günler" butonu** eklendi (`data-testid="menu-week-btn"`). Tıklayınca merkez modal açılır:
  - Dün + Bugün + Sonraki 6 gün (8 satır)
  - Her gün için: gün kutusu (DD + ay), gün adı, BUGÜN rozeti (bugünse altın), yemek chip'leri (numara + isim), notlar.
  - Menü girilmemiş günler "Menü girilmemiş" italic placeholder ile gösterilir.
  - Skeleton loading + kapatma X butonu + backdrop click ile kapanır.
- Menüsü henüz girilmemiş günlerde bile kart görünüyor (kullanıcı "Diğer Günler" görerek haftayı kontrol edebilir).
- `AnimatePresence` + framer-motion entry animasyonları. Mobil-öncelikli responsive.

### Test (Playwright e2e)
- [1] Menü kartı görünür ✅
- [2] Diğer Günler dialog'u açılıyor, 8 satır, BUGÜN rozeti var ✅
- [3] Dialog kapanma çalışıyor ✅
- [4] Küçültme tuşu chip'leri gizliyor ✅
- [5] localStorage tercihi kalıcı ✅
- [6] Tekrar genişletme çalışıyor ✅

### data-testid'ler
`home-today-menu`, `menu-collapse-toggle`, `menu-week-btn`, `menu-week-dialog`, `menu-week-close`, `menu-week-row-{YYYY-MM-DD}`

### Tasarım Notu
- Framer Motion `transform` animasyonu Tailwind `-translate-x-1/2 -translate-y-1/2` ile çakışıyordu. Çözüm: fixed-positioning'i wrapper `<div>`'e taşı; motion.div yalnızca opacity/scale/y animasyonu yapsın (modal merkezleme: parent `flex items-center justify-center`).

---

## Güvenlik Yaması: Messenger Yetkisiz Erişim Önleme (14 Şubat 2026)

**Bildirilen sorun:** Mesajlar (Messenger FAB + drawer) kullanıcı giriş yapmadan da görülebiliyordu.

### Kök sebep
- `GlobalMessenger.jsx` ve `MessengerPanel.jsx` yalnızca `getSession()` ile token varlığını kontrol ediyordu — 24h süre / `remember_me` politikası göz ardı ediliyordu.
- 24 saat dolmuş eski oturumun token'ı localStorage'da kaldığı sürece messenger FAB görünüyordu.
- `clearSession()` ve `saveSession()` herhangi bir DOM event yayınlamıyordu → GlobalMessenger yalnızca 2 saniye polling ile yakalıyordu (anlık değil).

### Yapılanlar
1. **`GlobalMessenger.jsx`**: `getSession()` yerine `isSessionValid() ? getSession() : null` ile gerçek geçerlilik kontrolü. Auth değişiminde `disconnectChatWS()` çağrılarak eski token'la açık kalan WebSocket kapatılıyor (eski token'la mesaj yayınlanmasını engeller).
2. **`MessengerPanel.jsx`**: Aynı şekilde `isSessionValid()` kontrolü eklendi — defense-in-depth.
3. **`lib/auth.js`**:
   - `saveSession()` artık `auth-changed` CustomEvent (type:"login") dispatch ediyor.
   - `clearSession()` artık `auth-changed` CustomEvent (type:"logout") dispatch ediyor.
   - Tüm subscriber'lar (GlobalMessenger, vb.) anlık güncellenir; 2 saniye polling beklemek zorunda değil.

### Backend doğrulaması
- Tüm `/api/chat/*` REST endpoint'leri zaten `Depends(get_current_user)` ile korunuyor (401 dönüyor — test edildi).
- WebSocket `/api/ws/chat` query param ile JWT doğruluyor, geçersiz token'da `code=4401` ile kapatıyor.

### Test (Playwright e2e — 5/5 geçti)
| Senaryo | Beklenen | Sonuç |
|---|---|---|
| Girişsiz ziyaret | FAB yok | ✅ 0 |
| Auth'suz REST /api/chat/conversations | 401 | ✅ 401 |
| Geçerli login (ali) sonrası | FAB var | ✅ 1 |
| `localStorage.clear()` + auth-changed event | FAB hemen kayboluyor | ✅ 0 |
| 25h eski stale session (remember_me=false) | FAB yok | ✅ 0 (önceki: 1 — BUG) |
| Sahte JWT token + recent login_at | Backend 401 → frontend kendini temizler → FAB yok | ✅ 0 |

### Etki
- Mesajlaşma artık YALNIZCA geçerli oturumla görünür ve çalışır.
- Logout / 24h timeout / token reject sonrası WS bağlantısı otomatik kapanıyor (eski kimlikle veri sızıntısı yok).

---

## Mobil/Web Responsive Header Yaması (14 Şubat 2026)

**Sorun:** Mobilde (özellikle iPhone, viewport ≤ 414px) tüm panel header'larındaki çok sayıda buton (Vardiya/Menü/Yedek/Bobin Recalc/Bildirim/Sync/Push/Theme/UserMenu/Logout vb.) yatayda taşıyordu. Body içeriği de sağa kayıyordu (BOYA STOKU vs. truncate). Kullanıcı: "üst bar hiçbir panelde sığmıyor".

### Çözüm
**Yeni component:** `/app/frontend/src/components/HeaderActionsMenu.js`
- Desktop (`md:` ve üstü): Tüm aksiyon butonları inline, eskisi gibi.
- Mobil (`< md`): Tek bir **"Daha Fazla" kebab butonu** (`MoreVertical`) — tıklayınca premium-amber dropdown menüde ikincil aksiyonlar listelenir.
- `items` props ile esnek API: `{ id, label, icon, onClick, testId, accent, disabled, badge, render }`. `render` ile özel komponentler (SyncBadge, NotificationButton) da menüye eklenebilir.

### Tüm panellerde uygulandı
- **ManagementFlow**: Menü, Yedek, Bobin Recalc, Bildirim Ayarları, Sync, Push, Theme → mobilde tek menü.
- **PlanFlow**: Push + Theme → mobilde tek menü.
- **OperatorFlow**: Notification permission + Theme → mobilde tek menü.
- **WarehouseFlow**: WS status + Push + Theme → mobilde tek menü.
- **BobinFlow**: Arşiv + Excel + Theme → mobilde tek menü.
- **MarkaStokFlow**: Theme → mobilde tek menü.
- **PaintFlow**: Theme + UserMenu (zaten az; mobile-fit'ler revize).
- **DriverFlow**: Theme + UserMenu (mobile-fit revize).

### Ortak iyileştirmeler her panelde
- Root `<div>`'e `overflow-x-hidden` eklendi → body içeriği yatay kaymıyor.
- Header container `min-w-0` + child `shrink-0`/`min-w-0` ile texto/ikon arası akıllı sıkıştırma.
- Back butonu mobilde `size="icon"` (sadece ikon), desktop'ta etiketli.
- Logout butonu mobilde `size="icon"`.
- Header padding mobilde sıkılaştırıldı: `px-3 sm:px-4 md:px-6`.
- Logo altındaki "Yönetim Paneli / Plan / Operatör" metni `truncate` ile uzun başlıkları kırpıyor.

### Test (Playwright 390×844 iPhone X viewport)
| Panel | scrollWidth/clientWidth | Sonuç |
|---|---|---|
| /management | 390/390 | ✅ OK |
| /plan | 390/390 | ✅ OK |
| /operator | 390/390 | ✅ OK |
| /warehouse | 390/390 | ✅ OK |
| /bobin | 390/390 | ✅ OK |
| /marka-stok | 390/390 | ✅ OK |
| /paint | 390/390 | ✅ OK |

Desktop (1440×900): Tüm butonlar inline, More-actions butonu görünmüyor (md:hidden) — eski deneyim korundu.

**Mobil More menüsü işlevsel doğrulama:** 5 menu item göründü, "Yedek" tıklama dialog açtı, "Theme" toggle çalıştı (dark → light).

### data-testid'ler
`header-more-actions-btn`, `header-more-actions-menu`, ve mobilde her item için `{original-testid}-mobile` (örn. `backups-btn-mobile`, `theme-toggle-mobile`).

---

## Real-time Mesaj + Tarayıcı Bildirimi Yaması (14 Şubat 2026)

**Sorun:** 
1. Mesaj gönderilince karşı taraf mesajı **sayfa yenilenmeden** göremiyordu (WS event tetiklenmesine rağmen)
2. Tarayıcı bildirim göndermiyordu (online kullanıcıya hiçbir uyarı yok)

### Kök sebep — Stale Closure
`MessengerPanel.jsx`'te `handleWsEvent` fonksiyonu `useEffect`'e (`[userId]` dependency'sinde) bir kez kayıt oluyordu. Listener içinde `activeId`, `open`, `userId` state'leri okunuyordu → React closure listener register edildiği andaki **eski** değerleri görüyordu. Sonuç: WS event geliyor ama doğru conversation/state ile karşılaştırılamıyordu.

### Çözüm
1. **`handleWsEventRef = useRef()`** eklendi
2. `useEffect(() => { handleWsEventRef.current = handleWsEvent; })` her render'da ref güncellenir
3. WS listener `(evt) => handleWsEventRef.current(evt)` — daima en güncel handler'ı çağırır

### Ek: Tarayıcı Bildirimi + Ses
- `new_message` event'inde, eğer `Notification.permission === "granted"` VE (drawer kapalı VEYA tab arka plandaysa):
  - `new Notification(...)` ile native browser bildirimi gösterilir (8 sn sonra auto-close)
  - Tıklama: window focus + drawer aç + ilgili conversation aktif et
- **WebAudio API ile inline beep** (asset gerektirmez) — sin dalga 880Hz→1320Hz arası kısa "ding"
- Push subscription zaten `ensurePushSubscription()` ile drawer açıldığında alınıyor (offline kullanıcılar için)

### Test (Playwright e2e, 2 ayrı browser context)
| Senaryo | Sonuç |
|---|---|
| A "yonetim" loglandı, mesaj gönderdi | ✅ |
| B "plan" oturumunda anında unread badge gördü | ✅ |
| B mesaj preview'ını refresh OLMADAN listede gördü | ✅ |
| B mesajı refresh OLMADAN conversation içinde gördü | ✅ |

### Etkilenen Dosyalar
- `/app/frontend/src/components/messenger/MessengerPanel.jsx` (stale closure fix + native notification + WebAudio beep)

---

## Mesajlaşma — Polling Fallback + Tüm Cihazlara Push (14 Şubat 2026)

**Kullanıcı isteği:** Mesajlar her ne olursa olsun anlık gelsin. Web bildirimi karşı tarafa **mutlaka** ulaşsın.

### Yapılanlar
1. **Polling fallback** (`MessengerPanel.jsx`):
   - Drawer açıkken aktif konuşmayı **3 sn'de**, kapalıyken **6 sn'de** yenileniyor.
   - WS event'le aynı state'e yazar, ID-bazlı dedupe edilir, sıralanır.
   - Garanti: WebSocket kopuk/yavaş olsa da kullanıcı en geç 6 saniye içinde yeni mesajı görür.

2. **Auto-request notification permission** (kullanıcı login olur olmaz):
   - Drawer açılmasını beklemez — 4 saniye sonra `Notification.requestPermission()` çağrılır.
   - Granted → `ensurePushSubscription()` → VAPID subscription backend'e kaydedilir.

3. **Backend (`routes/chat.py`)**:
   - Push gönderimi **online filtresinden kaldırıldı** — her mesajda **tüm diğer participant'lara** push gönderir.
   - SW dedupe (`tag: conv-{id}`) sayesinde aynı kullanıcı duplicate bildirim görmez.
   - Body fallback'leri: text yoksa "📎 Ek dosya" ya da "Yeni mesaj".

4. **Service Worker (`sw.js`)**:
   - Icon path'i `/icon-192.png` → `/logo192.png` düzeltildi (dosya gerçekten var).
   - CACHE_VERSION v2 → v3 (eski SW'yi force-replace eder).

### Test (Playwright e2e, 2 ayrı oturum)
| Senaryo | Sonuç |
|---|---|
| A "yonetim" → mesaj | ✅ |
| B "plan" — unread badge **1 saniyede** | ✅ |
| B mesaj preview'ını listede görür (refresh yok) | ✅ |
| B mesajı konuşmada görür (refresh yok) | ✅ |
| B yanıt → A da **1 saniyede** görür | ✅ |

### Etki
- WS çalışırsa ANLIK (<200ms) güncelleme.
- WS kopuksa en geç **6 saniyede** polling ile.
- Push notification her cihazda (browser açık/kapalı, tab arka planda olsa bile) tetiklenir.
- Tarayıcı bildirimi `tag: conv-{id}` ile dedupe edilir.

---

## Müşteri Yönetim Sistemi (18 Şubat 2026)

**Kullanıcı isteği:** Plan'da iş ekleme sırasında müşteri seçimi/yeni ekleme + Yönetim ve Plan panellerinde müşterilerin mevcut/geçmiş işlerini görüntüleme.

### Backend
1. **`Customer` model** (`/app/backend/models.py`): id, name, phone, address, email, notes, code (otomatik BK-YYYY-NNN), total_jobs, last_order_at, archived.
2. **`Job` modeline eklendi:** `customer_id`, `customer_name` (snapshot — müşteri ismi değişse de iş kayıtta korunur).
3. **`/app/backend/routes/customers.py`** — yeni CRUD:
   - `GET /api/customers?q=X&include_archived=0` — liste + arama
   - `GET /api/customers/search?q=` — combobox için hızlı arama (son sipariş veren 10 default)
   - `GET /api/customers/{id}` — detay
   - `GET /api/customers/{id}/jobs` — aktif + geçmiş iş listesi (status'a göre ayrılır)
   - `POST /api/customers` — yeni (isim dedupe, otomatik kod, `_existed: true` flag idempotency)
   - `PUT /api/customers/{id}` — güncelle
   - `DELETE /api/customers/{id}` — soft delete (archived)
4. **Job create hook:** `on_job_created(customer_id)` → total_jobs +1, last_order_at şimdi.
5. **MongoDB indexes:** `customers.name`, `customers.phone`, `customers.code`, `jobs(customer_id, created_at)`.

### Frontend (reusable component'ler)
- **`CustomerCombobox.js`** — Tıklayınca açılan dropdown, inline arama, son siparişler default, "+ Yeni Müşteri" inline form. Premium-amber tasarım.
- **`CustomerDetailDialog.js`** — Müşteri detay modal'ı. Header'da isim+kod+telefon+e-posta+adres+not, Aktif/Geçmiş tab'ları, her iş için status badge+koli ilerlemesi+makine+tarih.
- **`CustomerEditDialog.js`** — Yeni ekle / mevcudu düzenle (ortak form).
- **`CustomersManagementPanel.js`** — Yönetim için liste sayfası: arama + arşivli toggle + ekleme + kart grid + tıklayınca detay.

### Entegrasyon
- **Plan / Yeni İş Dialog'u:** İş Adı'nın ÜSTÜNE CustomerCombobox eklendi. Seçilince `customer_id + customer_name` payload'a, ayrıca `delivery_phone` otomatik dolar.
- **Yönetim Paneli → Müşteriler tab:** Tabs'a yeni `customers` tab eklendi (Kullanıcılar'dan sonra), CustomersManagementPanel render eder.
- **Plan Paneli → Müşteriler butonu:** Header More menüsünde "Müşteriler" item'ı → dialog'da CustomersManagementPanel açılır (tam paritesi).
- **Plan iş kartı:** customer_name varsa altın User ikonuyla rozet gösterilir.

### Test (Playwright e2e)
| Senaryo | Sonuç |
|---|---|
| Yönetim → Müşteriler tab → 4 kart görünür | ✅ |
| "+ Yeni Müşteri" → form → kayıt → liste yenilenir | ✅ |
| Card tıkla → Detail dialog (Aktif/Geçmiş tabları) | ✅ |
| Plan → Yeni İş → CustomerCombobox arama "Loj" → 1 sonuç | ✅ |
| Müşteri seç → chip olarak göster → iş kayıt edildiğinde customer_id korunur | ✅ |
| `/api/customers/{id}/jobs` aktif iş 1 sayar (aggregate doğru) | ✅ |
| Plan → Müşteriler → 4 kart, card tıkla → 1 aktif iş | ✅ |

### Otomatik
- İsim aynı ise yeni eklemez, var olan müşteriyi seçtirir (`_existed: true` UI'da toast olarak gösterilir).
- BK-2026-001 sıralı kod otomatik (her yıl yeniden başlar).
- Müşteri ismi sonradan değişse bile eski işlerde snapshot olarak korunur.

---

## Yemek Menüsü Toplu Haftalık Editör (18 Şubat 2026)

**Kullanıcı isteği:** Yemek menüsünü her gün ayrı ayrı girmek yerine, **haftalık tek ekranda toplu edit** + drag-drop ile gün-gün kopyala.

### Backend
- `POST /api/menu/bulk` (`routes/menu.py`) — `{ menus: [{date, items, notes?}, ...] }` payload'ı ile tek istekte birden fazla gün upsert + boş gönderilen günler silinir.
- Dönüş: `{saved, deleted, errors[], message}`.

### Frontend (`/app/frontend/src/components/WeeklyMenuEditor.js`)
- **7 gün grid:** Pazartesi-Pazar yan yana (1 kolon mobil, 2 tablet, 4 masaüstü).
- **Hafta gezinme:** ← bu hafta → butonları + "Bu Hafta" reset.
- **Her gün için:**
  - Bugün altın renk + "BUGÜN" rozeti
  - Yemek listesi: numara + input + sil butonu, "Yemek ekle" placeholder
  - Notlar inline textarea
  - Değiştiğinde altın outline + "Değişti" rozeti
- **Drag-Drop:** Gün başlığını sürükle (GripVertical handle) → başka güne bırak → o günün **items + notes kopyalanır**. Drop alanı altın highlight + scale animasyon.
- **"Sonraki Haftaya Kopyala":** Tek tıkla bu haftanın tüm menülerini ileri kopyalar (onay diyaloğu) + otomatik yeni haftaya geçer.
- **"Tümünü Kaydet":** Bulk endpoint'e tek istek → dirty flag'ler temizlenir.

### Eski single-day dialog kaldırıldı
- ManagementFlow → "Menü" butonu artık doğrudan `WeeklyMenuEditor`'ü açıyor.
- Eski `menuDialogOpen` state korundu (tek noktadan yeni component'e bağlandı).

### Test (e2e + curl)
| Senaryo | Sonuç |
|---|---|
| `POST /api/menu/bulk` 2 gün dolu + 1 boş | saved=2, deleted=0 ✅ |
| Yönetim → Menü → editor görünür | ✅ |
| 7 gün kartı + sürükleme tutamaçları | ✅ |
| Yemek ekle + not + Kaydet → backend'e gider | ✅ |
| API'den doğrulama (`GET /api/menu?date=...`) | ✅ items + notes |

### data-testid'ler
- `weekly-menu-editor`, `weekly-menu-day-{YYYY-MM-DD}`, `weekly-menu-day-{date}-drag`
- `weekly-menu-item-{date}-{idx}`, `weekly-menu-item-del-{date}-{idx}`, `weekly-menu-add-{date}`
- `weekly-menu-notes-{date}`, `weekly-menu-save`, `weekly-menu-close`
- `copy-to-next-week`, `week-prev-btn`, `week-today-btn`, `week-next-btn`

---

## Real-time Mesaj — Defansif 3-Yollu Fan-out (18 Şubat 2026)

**Sorun (kullanıcı tekrar bildirdi):** Mesaj refresh olmadan ulaşmıyor + push/ses bildirimi gelmiyor.

### Kök sebep (kombine)
1. chat-WS bağlantısı bazı tarayıcılarda token expire / nginx WS upgrade / firewall sebebiyle sessizce kopuyordu.
2. Polling fallback 3-6 sn idi — kullanıcı için "yeterince anlık" değildi.
3. Notification permission sadece drawer açılınca isteniyordu — kullanıcı hiç açmadıysa hiç istenmiyordu.

### Çözüm — 3 paralel yol
1. **Backend fan-out:** `routes/chat.py send_message` artık chat-WS yanında **manager-WS + warehouse/operator-WS** üzerinden de aynı `new_message` payload'ını yayınlıyor. Production'da kararlı olan eski WS altyapısı garanti veriyor.
2. **Frontend bridge:** ManagementFlow, WarehouseFlow, OperatorFlow `new_message` event'i yakaladığında `window.dispatchEvent("chat-message-fanout")` yayınlıyor. MessengerPanel `chat-message-fanout` listener'ı ile aynı handleWsEvent'i tetikliyor.
3. **Polling sıkılaştırma:** Drawer açık 2sn, kapalı 4sn (eski 3/6).
4. **Notification:** Login sonrası 4sn'de zaten otomatik isteniyor (önceki yamada eklendi).

### Test (e2e — 2 ayrı oturum, chat-WS zorla kapatıldı)
| Adım | Süre | Sonuç |
|---|---|---|
| A → B mesaj (chat-WS down simülasyon) | <1s | ✅ Badge göründü |
| B mesajı conversation içinde görür | <2s | ✅ |

### Dosyalar
- `/app/backend/routes/chat.py` — fan-out (manager_mgmt + manager broadcast)
- `/app/frontend/src/components/messenger/MessengerPanel.jsx` — `chat-message-fanout` window event listener, polling 2/4s
- `/app/frontend/src/pages/ManagementFlow.js` — WS onmessage'de new_message → window event
- `/app/frontend/src/pages/WarehouseFlow.js` — aynı bridge
- `/app/frontend/src/pages/OperatorFlow.js` — aynı bridge (yeni messenger için ek koşul)

### Etki
- chat-WS çalışırsa **anlık** (<200ms).
- chat-WS kopuksa manager-WS fan-out **anlık** (<500ms).
- Manager-WS de yoksa polling **2 saniyede**.
- Push notification: VAPID subscription kayıtlıysa **OS-level bildirim** (browser kapalı olsa bile).

---

## Bug Fix — Yönetim Panelinde İşlem Kayıtları Çökmesi (React #31) — 26 Tem 2026

### Sorun
Production'da (`bksistem.space/management`) "İşlem Kayıtları" sekmesi açıldığında sayfa çöküyordu:
`Minified React error #31 — object with keys {customer_id, name, code}`.

### Kök Sebep
`routes/customers.py` içindeki 3 `log_audit()` çağrısı YANLIŞ argüman sırasıyla yapılıyordu
(`log_audit("customer_create", username, {dict})`). Doğru imza: `log_audit(user, action, entity_type, entity_name, details)`.
Sonuç: `audit_logs.entity_type` alanına dict yazıldı → React tabloda object render edemedi.

### Çözüm (4 katmanlı)
1. `routes/customers.py` — create/update/archive log_audit çağrıları doğru sıraya alındı.
2. `services/audit.py` — `_as_text()` helper: tüm alanlar yazma anında stringe zorlanıyor (dict/list → JSON).
3. `routes/misc.py` `GET /audit-logs` — legacy bozuk kayıtlar okuma anında stringe çevriliyor (production DB'de migration gerekmez).
4. `pages/ManagementFlow.js` — `safeText()` helper (line ~41) audit tablosunun tüm hücrelerinde.

### Test (iteration_46.json — Backend 4/4, Frontend %100)
- Bilerek bozuk legacy kayıt (BADLEGACY1) eklendi → API string döndü, UI çökmedi ✅
- Yeni müşteri oluşturma → audit satırı doğru (adminusr / create / customer / ad / "Kod: BK-...") ✅
- Sayfalama (Sonraki/Önceki) çökmeden çalışıyor ✅

### Backlog notu
- (P3) `log_audit()` keyword-only argümanlara çevrilebilir → bu hata sınıfı tamamen engellenir.

---

## Bug Fix — Mükerrer "İş Tamamlandı" Bildirimi (2-3 kez) — 26 Tem 2026 (Iteration 47)

### Sorun
Plan + Yönetim rolündeki kullanıcılar bir iş tamamlandığında aynı bildirimi 2, bazen 3 kez alıyordu.

### Kök Sebepler (4 ayrı kanal aynı olayı iletiyordu)
1. `PUT /api/jobs/{id}/complete` idempotent değildi → çift tıklama/retry ikinci bildirim akışını tetikliyordu.
2. `auto_chat.notify_job_completed` olayı #plan VE #yonetim kanalına yazıyor, her kanal için ayrı Web Push gönderiyordu → çoklu role sahip kullanıcı 2 push alıyordu.
3. `send_notification_to_managers` + `send_notification_to_plan_users` ayrı ayrı çağrılıyordu → aynı cihaz token'ı 2 FCM alabiliyordu.
4. Frontend: WS `job_completed` toast + FCM foreground toast + MessengerPanel WS `new_message` (fan-out + 2 kanal) → 2-3 in-app/OS bildirimi.

### Çözüm (4 katman)
1. `routes/jobs.py complete_job` — iş zaten `completed` ise `{already_completed: true}` döner, bildirim akışı tekrar çalışmaz.
2. `services/auto_chat.py` — `_save_and_broadcast(push_tag, push_dedup)`; `notify_job_completed` kanallar arasında paylaşılan `push_dedup` set'i ile kullanıcı başına TEK push; mesaj meta'sına `event_key = evt-job_completed-{job_id}`.
3. `services/notifications.py` — yeni `send_notification_to_user_types(["manager","plan"], ...)` token'ları tekilleştirir; `send_fcm_notification` webpush `tag` destekler (OS bildirimleri birleşir).
4. Frontend — yeni `utils/alertDedup.js` (`shouldAlertOnce`, `alertKeyForMessage`); ManagementFlow (WS + FCM + local complete toast), PlanFlow (FCM), MessengerPanel (toast/notification/beep) tek uyarı; `sw.js` + `firebase-messaging-sw.js` ortak `tag` kullanır.

### Test (iteration_47.json — Backend 4/4, Frontend %100)
- complete 3x çağrı → 2. ve 3. yanıt `already_completed: true` ✅
- Chat mesajı hâlâ her iki kanalda, `event_key` aynı ✅
- Yönetim panelinde iş tamamlama → TEK toast ✅ · /plan hatasız ✅

---

## Yeni Rol: Boyacı + Boyacı Paneli — 26 Tem 2026 (Iteration 48)

### Kullanıcı isteği
"Boyacı" rolü oluşturulacak; Boya paneline (/paint) erişebilecek + kendisine özel yeni panel (/boyaci):
üretilecek toplam koli, hangi makine ne iş yapıyor, sıradaki işler (görsel/müşteri/not/kaç gündür bekliyor),
işi başlatma (operatör seçimi ZORUNLU) ve tamamlama, sürükle-bırak sıralama (sıra tüm panellerde otomatik revize).
Paneli sadece `yonetim` + `boyaci` görebilir. **Kullanıcı seçimleri:** tüm makineler · silme/düzenleme YOK · messenger: Genel + Planlama.

### Backend
- `routes/users.py` — `VALID_ROLES` / `ALL_PANEL_ROLES` + `boyaci`.
- `services/validators.py` — `ROLE_WHITELIST` + `boyaci`.
- `models_chat.py` — `#genel` ve `#plan` kanallarına `boyaci` auto-join.
- `routes/jobs.py start_job` — **operator_name artık zorunlu** (boş/whitespace → 400 "Operatör seçimi zorunlu").
- Yeni endpoint YOK; mevcutlar kullanıldı: `/jobs`, `/machines`, `/users?role=operator`, `/jobs/expected-summary`, `/jobs/{id}/start`, `/jobs/{id}/complete`, `/jobs/reorder-batch`, `/jobs/{id}/image`.

### Frontend
- **YENİ** `pages/BoyaciFlow.js` — pembe/fuşya kimlik; Üretilecek Toplam Koli kartı (makine kırılımı pop-up'lı),
  Makine Durumu ızgarası (aktif iş görseli/müşteri/not/bekleme/ilerleme + "İşi Tamamla"),
  Sıradaki İşler (dnd-kit sürükle-bırak → `PUT /jobs/reorder-batch` → tüm paneller aynı `order` alanını okuduğu için otomatik senkron),
  Başlat dialogu (kayıtlı operatör listesi + "Diğer (isim yaz)"), Tamamla onay dialogu, görsel önizleme modalı.
- `App.js` — lazy `/boyaci` route (ProtectedRoute + ErrorBoundary).
- `lib/auth.js` — `ROUTE_ROLES["/boyaci"]=["yonetim","boyaci"]`, `/paint`'e `boyaci`, `ROLE_DEFAULT_ROUTE.boyaci="/boyaci"`, `boyaci_session` panel key.
- `Home.js` — "Boyacı Paneli" modül kartı + Yönetim Hızlı Panel kısayolu · `UserMenu.js` ROUTE_META · `ManagementFlow.js` rol grid'ine "Boyacı 🎨" (yeni kullanıcı + rol düzenleme) · MessengerPanel rol etiketi/rengi.

### Test (iteration_48.json — Backend 6/6, Frontend %100)
RBAC (boyaci → /management redirect, /paint açık), operatörsüz başlatma engeli (UI + backend 400),
başlat/tamamla akışı, reorder persist + Plan panelinde aynı sıra, diğer panellerde regresyon yok.

### Test kullanıcısı
`boyaci1 / boya123` (bkz. /app/memory/test_credentials.md)

### Backlog notu
- (P3) Boyacı panelinde aktif işler sürüklenemez; UX için "başlatılan iş taşınamaz" görsel ipucu eklenebilir.

### Boyacı Paneli — Filtreler + Panel Arası Sıra Senkronizasyonu (26 Tem 2026, Iteration 49-50)
- **Filtreler** (`BoyaciFlow.js`): Sıradaki İşler üstünde **Makine chip'leri** (`boyaci-filter-machine-{id}`, adet sayacıyla) ve **Ölçü/format chip'leri** (`boyaci-filter-format-{fmt}` — 33x24, 30x30, 1/4 vb.), AND mantığıyla birlikte çalışır; arama kutusu (`boyaci-search-input`, iş adı/müşteri/renk/not) + "Filtreyi Temizle" (`boyaci-filters-clear`). Başlık `Sıradaki İşler (X / Y)`. Kartlarda ölçü rozeti (`boyaci-format-{id}`) ve sıra numarası GLOBAL sıradaki yeri gösterir.
  - Not: Aynı makine farklı ölçüde iş yapabildiği için (ör. 40x40 makinesinde 33x24 iş) filtreler bağımsızdır.
- **Filtre açıkken sürükleme güvenli**: `handleDragEnd` filtrelenen işleri GLOBAL slotlarına geri yerleştirir → filtre dışı işlerin sırası hiç değişmez (testing agent ile matematiksel olarak doğrulandı).
- **BUG FIX — panel arası sıra senkronizasyonu**: `GET /api/jobs` artık `status == "pending"` iken `[("order",1),("created_at",1)]` ile sıralıyor (diğer statülerde created_at korunur → geçmiş listeleri bozulmaz). Ek olarak PlanFlow / OperatorFlow / ManagementFlow bekleyen iş listeleri istemci tarafında da `order`'a göre sıralanıyor.
- Test: iteration_49.json (filtreler %100) + iteration_50.json (backend 3/3, Boyacı→Plan senkron doğrulandı).

---

## AI: GPT-5.2 → Claude Opus 4.8 + Her Panele AI Asistanı — 26 Tem 2026 (Iteration 51)

### Kullanıcı isteği & kararlar
"GPT-5.2'yi Claude Opus 5 ile değiştirip her panele ekleyelim."
→ `claude-opus-5` Emergent Universal Key'de HENÜZ AÇIK DEĞİL (probe: "Invalid model name"). Kullanıcı onayıyla **Claude Opus 4.8** kuruldu.
Kullanıcı seçimleri: (1a) tüm çağrılar en güçlü Claude · (2b) sohbet geçmişi kullanıcı+panel bazlı KALICI · (3a) AI SALT OKUNUR.

### Backend
- **YENİ** `services/ai_config.py` — merkezi model: `.env` `AI_PROVIDER=anthropic`, `AI_MODEL=claude-opus-4-8`; `build_chat()` helper. **Opus 5 açıldığında tek satır `.env` değişimi yeter.**
- `routes/ai.py` (4 endpoint) + `routes/paints.py` (paint-forecast) → `build_chat` kullanıyor, `gpt-5.2` referansı kalmadı.
- **YENİ** `routes/ai_panel.py`:
  - `POST /api/ai/panel-chat` {panel, message} — panel bazlı canlı DB context (makine durumu, kuyruk/order, kalan koli, boya/bobin/marka stok, depo talepleri, sevkiyat).
  - `GET|DELETE /api/ai/panel-history?panel=` — `ai_panel_messages` koleksiyonunda kalıcı geçmiş (son 12 mesaj system prompt'a bağlam olarak gömülür → tek LLM çağrısı, düşük token maliyeti).
  - `GET /api/ai/panel-info` — aktif model bilgisi.
  - RBAC: `PANEL_ROLES` (yonetim her panele erişir; boyaci → boyaci+paint; depo → depo/bobin/marka_stok/paint vb.), yetkisiz panel → 403.
- `server.py` — router include + `ai_panel_messages` index.

### Frontend
- **YENİ** `components/AIAssistant.jsx` — header'da sparkle butonu + sağdan açılan sohbet çekmecesi; panel bazlı örnek sorular, kalıcı geçmiş, "Geçmişi temizle", model adı gösterimi.
- Eklendiği paneller: **Plan, Boyacı, Depo, Bobin, Marka/Koli Stok, Sürücü, Boya**. Yönetim ve Operatör panellerindeki mevcut AI özellikleri korundu (artık Claude ile).
- data-testid: `ai-assistant-btn-{panel}`, `ai-assistant-drawer-{panel}`, `ai-input-{panel}`, `ai-send-{panel}`, `ai-clear-{panel}`, `ai-suggestion-{panel}-{i}`.

### Test (iteration_51.json — Backend 20/20 pytest, Frontend %100)
Model doğrulaması, 9 panel için anlamlı Türkçe yanıt, RBAC 403, validation 400, kalıcı geçmiş GET/DELETE, UI e2e (Boyacı) ve 6/7 panel buton kontrolü (sofor paneli sürücü girişi arkasında).
Sonrasında token optimizasyonu: geçmiş artık ek LLM çağrısı yerine system prompt'a gömülüyor — süreklilik curl ile doğrulandı ("bir önceki soruda ne sormuştum?" → doğru yanıt).

### Backlog
- (P2) Opus 5 Universal Key'de açıldığında `.env AI_MODEL=claude-opus-5` yap.
- (P3) Sürücü paneli için test credential'ı oluştur (AI butonunu UI'da doğrulamak için).
