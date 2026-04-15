# Buse Kagit - Uretim Yonetim Sistemi PRD

## Original Problem Statement
Factory management system for Buse Kagit paper company. Full-stack React + FastAPI + MongoDB PWA with AI assistants, Excel exports, live dashboards, QR codes, drag & drop, and secure JWT/bcrypt authentication.

## User Personas
- **Yonetim (Management):** Factory owner/managers who oversee all operations
- **Plan:** Production planners who assign jobs to machines
- **Operator:** Machine operators who execute jobs
- **Depo (Warehouse):** Warehouse staff managing stock and shipments
- **Sofor (Driver):** Drivers handling deliveries
- **Musteri (Customer):** External customers tracking their orders via secure UUID links

## Core Requirements
- Fast PWA experience with offline support
- AI-powered assistance for operators and management (GPT-5.2)
- Excel exports for weekly/monthly reporting
- Live TV dashboard for factory monitoring
- Quick Transfer for job assignment between machines
- Shift management with auto-resume
- Drag & Drop job sorting
- Secure customer tracking links (UUID-based)
- QR Code generation and scanning
- JWT-based auth + bcrypt password hashing

## Architecture (Post-Refactoring - Feb 2026)

### Backend Structure
```
/app/backend/
├── server.py              # Main app (~160 lines) - FastAPI setup, routers, WebSockets, startup events, CORS
├── database.py            # MongoDB connection (client, db)
├── auth.py                # JWT + bcrypt helpers (hash_password, verify_password, create_token, decode_token, get_current_user)
├── models.py              # All Pydantic models (Machine, Job, Shift, User, Paint, etc.)
├── websocket_manager.py   # ConnectionManager, ManagerConnectionManager (ws_manager, ws_manager_mgmt)
├── services/
│   ├── __init__.py
│   ├── audit.py           # log_audit function
│   └── notifications.py   # Firebase FCM, Twilio WhatsApp, notification helpers
├── routes/
│   ├── __init__.py
│   ├── health.py          # /, /health
│   ├── machines.py        # /machines CRUD, maintenance, cleanup
│   ├── jobs.py            # /jobs CRUD, start/complete/pause/resume, clone, reorder, quick-transfer, tracking, upload
│   ├── shifts.py          # /shifts start/end, operator reports, approval flow
│   ├── defects.py         # /defects CRUD, weekly/monthly/daily analytics
│   ├── analytics.py       # /analytics weekly/daily/monthly/daily-detail/daily-by-week, Excel export
│   ├── users.py           # /users CRUD, /users/login, /management/login
│   ├── warehouse.py       # /warehouse-requests, /warehouse/shipment-log
│   ├── paints.py          # /paints CRUD, transactions, give-to-machine, return, analytics, AI forecast
│   ├── ai.py              # /ai operator-suggestion, operator-chat, management-overview, management-chat
│   ├── dashboard.py       # /dashboard/live
│   ├── messages.py        # /messages CRUD, read/unread tracking
│   ├── visitors.py        # /visitors log, stats
│   ├── operators.py       # /operator/session management
│   ├── pallets.py         # /pallets CRUD, search
│   ├── logistics.py       # /vehicles, /shipments, /drivers (CRUD, login, location, status)
│   └── misc.py            # /audit-logs, /managers/register, /notifications/register-token
```

### Frontend Structure
```
/app/frontend/src/
├── App.js                 # Routes, Axios JWT interceptor, visitor tracking
├── pages/
│   ├── Home.js            # Easter-themed home page
│   ├── ManagementFlow.js  # Management panel (2,813 lines)
│   ├── PlanFlow.js        # Planning panel with drag & drop (2,644 lines)
│   ├── OperatorFlow.js    # Operator panel with QR scanner (1,702 lines)
│   ├── PaintFlow.js       # Paint management (947 lines)
│   ├── WarehouseFlow.js   # Warehouse management (754 lines)
│   ├── DriverFlow.js      # Driver/shipping (556 lines)
│   ├── LiveDashboard.js   # Live TV dashboard (254 lines)
│   └── TrackingPage.js    # Customer tracking (167 lines)
├── components/
│   ├── ErrorBoundary.js
│   └── ui/                # Shadcn/UI components
```

## What's Been Implemented
- All core features (jobs, machines, shifts, paint, warehouse, analytics, AI)
- Security: JWT auth + bcrypt passwords
- PWA with service worker
- WebSocket real-time notifications
- Excel export (weekly/monthly reports)
- QR Code generation & scanning
- Drag & Drop job sorting
- Customer order tracking (UUID links)
- Live TV Dashboard (password protected)
- Easter-themed home page
- **Backend Refactoring** (Feb 2026): Monolithic server.py split into 23 modular files

## Upcoming Tasks (Prioritized)
- P1: Sevkiyat & Surucu Modulu (Shipment & Driver Module enhancements)
- P3: Renk Gecis Optimizasyonu (Color Transition Optimization)
- P3: Makine Bakim Planlayici (Machine Maintenance Planner)
- P3: Frontend bilesen refactoring (Extract common components from *Flow.js files)

## Known Issues
- VPN/ISP block on custom domain (bksistem.space) in Turkey - no code fix possible
