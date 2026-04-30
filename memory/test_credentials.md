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


## Notes
- All passwords (users + drivers) are bcrypt hashed in database
- JWT tokens are automatically managed by frontend Axios interceptor
- Tokens expire after 24 hours
- Login endpoints have rate limiting (10 requests/minute per IP)
- Dashboard password verified server-side (not in frontend JS)
