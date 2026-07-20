# LRMIS — Land Registration Management Information System

A digital platform for managing land registration: receiving registration requests, tracking field surveys, legal review, certificate issuance, and an interactive analytics/map dashboard.

**Stack:** FastAPI + MongoDB (PyMongo) + React/TypeScript (Vite).

---

## 1. Requirements

| Tool | Version |
|---|---|
| Python | 3.10+ |
| Node.js + npm | 18+ |
| MongoDB | Community Server, running locally on `localhost:27017` |

---

## 2. Running MongoDB

```powershell
net start MongoDB
```

Confirm it's running before starting the backend:
```powershell
Get-Service -Name MongoDB
```

---

## 3. Running the Backend

```powershell
cd backend
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000
```

Server runs at: `http://localhost:8000`
Swagger docs: `http://localhost:8000/docs`

### Environment Variables

Create a `.env` file (or rely on the defaults already in the code):

```env
MONGO_URL=mongodb://localhost:27017
DATABASE_NAME=lrmis_db
CERTIFICATE_VERIFY_BASE_URL=http://127.0.0.1:8000
CERTIFICATE_SIGNING_SECRET=change-this-local-certificate-secret
```

---

## 4. Running the Frontend

```powershell
cd frontend
npm install
npm run dev
```

Opens at: `http://localhost:5173`

> **Windows note:** if you get a `running scripts is disabled` error, run this once:
> ```powershell
> Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
> ```

---

## 5. Seed Data

After starting the backend (run once, or any time you start from an empty database):

```powershell
cd backend
python -m app.scripts.seed_data
```

Safe to run more than once — it checks whether each record already exists before inserting (no duplicates).

### Ready-to-use accounts after seeding (password: `Demo1234`)

| Username | Role | Note |
|---|---|---|
| `nour_applicant` | applicant | Linked to applicant profile: Nour Ahmad |
| `sami_staff` | staff | General pre-check / intake |
| `ahmad_surveyor` | surveyor | Linked to a `staff_members` record (zones ZONE-RM-01/02) |
| `sara_registrar` | registrar | Linked to a `staff_members` record |
| `admin_manager` | manager | Full administrative access (auto-assign, analytics, map) |

Password for all users: Demo1234

### Important rule — name matching

The system links a login account (`users.username`) to a staff profile (`staff_members.name`) by **exact string match**. If you create a new surveyor/registrar/staff account manually (via `POST /staff/`), the `name` field must match the `username` exactly — otherwise the "My survey tasks" page will show **"No assigned task profile yet"**.

---

## 6. MongoDB Indexes

Created automatically on server startup (from `app/indexes.py`). The key ones:

```python
db.users.create_index("username", unique=True)
db.land_applications.create_index("application_id", unique=True)
db.land_applications.create_index("status")
db.land_applications.create_index([("parcel_geojson", "2dsphere")])   # map/geofeeds
db.staff_members.create_index("staff_code", unique=True)
db.staff_members.create_index("coverage.zone_ids")
db.parcels.create_index([("geometry", "2dsphere")])
db.survey_tasks.create_index("application_id")
db.survey_tasks.create_index("assigned_surveyor_id")
```

---
## 7. Project Structure

```
LRMIS_PROJECT/
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── database.py
│   │   ├── indexes.py
│   │   ├── routers/        # applicants, applications, staff, survey, analytics, parcels, auth
│   │   ├── schemas/
│   │   ├── services/       # workflow_service, assignment_service, analytics_service, audit_service
│   │   ├── utils/           # security (JWT/roles)
│   │   └── scripts/
│   │       └── seed_data.py
│   └── requirements.txt
└── frontend/
    ├── src/
    │   ├── App.tsx           # all routes
    │   ├── api/               # applicationsApi, surveyApi, analyticsApi, authApi...
    │   ├── pages/             # all screens (Applicant/Staff/Surveyor/Analytics/Map)
    │   ├── components/        # Card, Button, StatusBadge, Sidebar, ToastProvider...
    │   └── theme.ts
    └── package.json
```

---

## Team

- Aya Assi — 1220794
- Mira Alabed — 1220467
