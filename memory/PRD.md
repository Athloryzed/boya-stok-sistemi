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
- Security: JWT auth on ALL endpoints + bcrypt passwords
- Dashboard password moved from client-side to server-side
- Backend refactoring: monolithic server.py → 23 modular files
- PWA, WebSocket, Excel export, QR Code, Drag & Drop, Customer tracking

## Upcoming Tasks
- P1: Sevkiyat & Surucu Modulu enhancements
- P3: Renk Gecis Optimizasyonu
- P3: Makine Bakim Planlayici
- P3: Frontend bilesen refactoring
