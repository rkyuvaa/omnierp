# OmniERP — Full-Stack ERP System

A modular ERP platform built with FastAPI + React + PostgreSQL.

## Quick Start

### Option A: Docker (Recommended)
```bash
docker-compose up -d
# Wait 10s for DB to start, then:
curl -X POST http://localhost:8000/api/auth/setup
# Frontend: open frontend/dist/index.html or run dev server
```

### Option B: Manual Setup

#### 1. Database
```bash
psql -U postgres
CREATE DATABASE erp_db;
CREATE USER erp_user WITH PASSWORD 'password';
GRANT ALL PRIVILEGES ON DATABASE erp_db TO erp_user;
\q
```

#### 2. Backend
```bash
cd backend
cp .env.example .env        # Edit if needed
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

#### 3. First-time Setup (creates admin + default data)
```bash
curl -X POST http://localhost:8000/api/auth/setup
# Login: admin@erp.com / admin123
```

#### 4. Frontend
```bash
cd frontend
npm install
npm run dev     # Dev: http://localhost:5173
# OR
npm run build   # Production build in dist/
```

---

## Folder Structure
```
erp/
├── backend/
│   ├── main.py                  # FastAPI app entry
│   ├── requirements.txt
│   ├── .env.example
│   └── app/
│       ├── config.py            # Settings
│       ├── database.py          # SQLAlchemy setup
│       ├── models.py            # All DB models
│       ├── auth.py              # JWT, passwords, audit
│       └── routers/
│           ├── auth.py          # Login, /me, setup
│           ├── users.py         # User CRUD
│           ├── branches.py      # Branch CRUD
│           ├── roles.py         # Role CRUD
│           ├── modules.py       # Module toggle
│           ├── crm.py           # Leads, customers, activities
│           ├── installation.py  # Installation records
│           ├── service.py       # Service requests
│           ├── studio.py        # Custom fields, stages, sequences
│           ├── dashboard.py     # Stats & charts data
│           └── audit.py        # Audit log viewer
│
└── frontend/
    └── src/
        ├── App.jsx              # Router
        ├── main.jsx             # Entry
        ├── index.css            # Design system
        ├── utils/api.js         # Axios instance
        ├── hooks/
        │   ├── useAuth.jsx      # Auth context
        │   └── useData.js       # Data fetching hooks
        ├── components/
        │   ├── Layout.jsx       # Shell + topbar
        │   ├── Sidebar.jsx      # Navigation
        │   ├── Shared.jsx       # Modal, Badge, Loader, etc.
        │   ├── CustomFields.jsx # Dynamic field renderer
        │   └── ModuleList.jsx   # Reusable list component
        └── pages/
            ├── Login.jsx
            ├── Dashboard.jsx
            ├── crm/
            │   ├── Leads.jsx
            │   └── LeadForm.jsx
            ├── installation/
            │   ├── InstallationList.jsx
            │   └── InstallationForm.jsx
            ├── service/
            │   ├── ServiceList.jsx
            │   └── ServiceForm.jsx
            ├── studio/
            │   └── Studio.jsx   # Fields + Stages + Sequences
            └── admin/
                ├── Users.jsx
                ├── Branches.jsx
                ├── Roles.jsx
                ├── Modules.jsx
                └── AuditLog.jsx
```

## API Endpoints
- `POST /api/auth/setup` — First-time setup
- `POST /api/auth/login` — Login
- `GET  /api/auth/me` — Current user
- `CRUD /api/users/`
- `CRUD /api/branches/`
- `CRUD /api/roles/`
- `CRUD /api/crm/leads`
- `CRUD /api/installation/`
- `CRUD /api/service/`
- `GET  /api/crm/leads/export/excel`
- `GET  /api/installation/export/excel`
- `GET  /api/service/export/excel`
- `CRUD /api/studio/fields/{module}`
- `CRUD /api/studio/stages/{module}`
- `POST /api/studio/sequence`
- `GET  /api/dashboard/`
- `GET  /api/audit/`

Full Swagger docs: http://localhost:8000/docs

---

## Biometric Integration & Deployment Modes

OmniERP supports two sync models for biometric attendance machines (e.g. eSSL/ZKTeco):

### Mode 1: Local / On-Premise Deployment (Direct Cloud-Pull)
* **Setup**: If your OmniERP server is hosted on the same local network as your physical biometric machines.
* **Mechanism**: The backend scheduler connects directly to the machine IPs.
* **Configuration**: Set `DISABLE_BIOMETRIC_SCHEDULER=false` (default) in `backend/.env`.

### Mode 2: Cloud Deployment (Push-Agent) - Recommended for AWS/Azure
* **Setup**: If your OmniERP server is hosted in the cloud (e.g., AWS, DigitalOcean) and your biometric machines are on private office networks behind firewalls.
* **Mechanism**: Use the `scripts/local_sync_agent.py` client on an office PC to securely connect to the local machines and push logs to the cloud API endpoint `/api/hr/attendance/sync/bulk`.
* **Configuration**: Disable the server-side connection scheduler to prevent connection timeouts and database pool exhaustion:
  ```env
  DISABLE_BIOMETRIC_SCHEDULER=true
  ```

---

## Production Security Best Practices

Before deploying OmniERP to a production environment, implement these security hardening measures:

1. **Restrict CORS Origins**: In `backend/main.py`, restrict `allow_origins` to your specific domain rather than `["*"]`.
2. **Enforce HTTPS**: Serve the API and frontend behind a secure reverse proxy (like Nginx with Let's Encrypt certificates).
3. **Database Security**: Ensure the database port `5432` is not publicly exposed; only allow access from the backend container.
