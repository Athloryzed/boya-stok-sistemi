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
- Yonetim rolüne sahip kullanıcılar TÜM panellere giriş yapabilir (auto-expand: operator, plan, depo, sofor, yonetim).
- ManagementFlow > Kullanıcı oluşturma > Roller bölümünden "Yönetim" (👑) seçilerek atanır.

## Notes
- All passwords (users + drivers) are bcrypt hashed in database
- JWT tokens are automatically managed by frontend Axios interceptor
- Tokens expire after 24 hours
- Login rate limits (CGNAT-friendly): /api/users/login 120/min, /api/drivers/login 120/min, /api/management/login 60/min, /api/dashboard/login 60/min — uses real client IP from X-Forwarded-For/CF-Connecting-IP
- Dashboard password verified server-side (not in frontend JS)
