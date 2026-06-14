# Test Credentials

## Management Panel
- URL: /management
- Password: buse11993

## Operator Panel
- URL: /operator
- Username: ali
- Password: 134679

## Plan Panel
- URL: /plan
- Username: emrecan
- Password: testtest12

## Warehouse Panel
- URL: /warehouse
- Username: depo1
- Password: depo123

## Bobin Management
- URL: /bobin
- Username: depo1
- Password: depo123

## Live Dashboard
- URL: /dashboard
- Password: buse4

## Driver Panel
- URL: /driver
- Name: Test Şoför
- Password: 1234

## Multi-Role Test User (Iteration 27+)
- Username: coklukullanici
- Password: test123
- Roles: plan + depo
- Can log in via /plan AND /bobin. Gets 403 on operator/sofor panels.

## Yonetim Role (Iteration 38+)
- Username: adminusr
- Password: admin123
- Roles: yonetim (auto-expands to operator + plan + depo + sofor + yonetim)
- Unified login (/): adminusr girişiyle TÜM panellere erişebilir. Yönetim Hızlı Panel FAB (data-testid="yonetim-quick-fab") sağ altta görünür.
- Yonetim rolüne sahip kullanıcılar TÜM panellere giriş yapabilir (auto-expand: operator, plan, depo, sofor, yonetim).
- ManagementFlow > Kullanıcı oluşturma > Roller bölümünden "Yönetim" (👑) seçilerek atanır.

## Notes
- All passwords (users + drivers) are bcrypt hashed in database
- JWT access tokens (NEW: 30 min) + refresh tokens (NEW: 7 days). Frontend auto-refreshes on 401.
- POST /api/auth/refresh body: {"refresh_token": "..."} → returns new {token, refresh_token, access_expires_in, refresh_expires_in}
- GET /api/auth/me returns the current user payload from JWT.
- POST /api/auth/logout body: {"refresh_token": "..."} → revokes that refresh JTI.
- Account lockout: 5 failed logins in 15 min → 15 min lockout (per-account, applies to user, driver, management & dashboard endpoints). 423 status returned. Cleared with successful login.
- Security headers: HSTS, CSP, X-Frame DENY, X-Content-Type nosniff, Referrer-Policy, Permissions-Policy on every API response.
- PII (users.phone, drivers.phone) encrypted in DB with Fernet (prefix `enc:v1:`); decrypted automatically in API responses.
- Audit logs are append-only with SHA-256 hash chain (prev_hash + entry_hash). Verify with GET /api/admin/audit/verify (yonetim).
- Audit alarms: critical actions write to `audit_alarms`. List: GET /api/admin/alarms; ACK: POST /api/admin/alarms/{id}/ack.
- Lockouts admin: GET /api/admin/lockouts; clear: DELETE /api/admin/lockouts/{account}.
- Security overview: GET /api/admin/security/status.
- Backups: AES-256-GCM encrypted on creation (`backup_*.archive.gz.enc`) + SHA-256 checksum + restore dry-run validation. Auto key stored at `/app/backend/.backup_key` (move to env BACKUP_ENCRYPTION_KEY for prod). Verify: POST /api/admin/backups/verify/{filename}.
- PII encryption key stored at `/app/backend/.pii_key` (move to env PII_ENCRYPTION_KEY for prod).
- 2FA fields (totp_enabled, totp_secret, backup_codes) exist in User model but NOT enforced yet (infra only).
- Login rate limits (CGNAT-friendly): /api/users/login 120/min, /api/drivers/login 120/min, /api/management/login 60/min, /api/dashboard/login 60/min — uses real client IP from X-Forwarded-For/CF-Connecting-IP
- Dashboard password verified server-side (not in frontend JS)
