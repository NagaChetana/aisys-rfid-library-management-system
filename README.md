# RFID-Enabled Intelligent Library Management System
**SOP Compliance:** AISYS Candidate Software Development SOP (Docs: `docs/AISYS_Assignment.pdf`)  
**Target Evaluation Date:** November 10, 2026  
**Implementation Progress:** Batch 1 Completed (Scaffold, Database WAL, Auth/RBAC, Catalog, Copies, Members, Dashboard)

---

## 1. System Overview

A modular, web-based, RFID-enabled Library Management System engineered to integrate core library operations with hardware-neutral RFID middleware, real-time security gate surveillance, handheld shelf auditing, protocol interoperability (NCIP 2.0 / SIP2), and spreadsheet data migration with atomic rollback.

### Key Architectural Characteristics
- **7-Layer Modular Architecture:** User Layer, Application Layer, RFID Middleware, Interoperability Layer, Data Layer, Integration Layer, Operations Layer.
- **Strict Data Integrity:** SQLite database with `PRAGMA journal_mode=WAL;` and `PRAGMA foreign_keys=ON;`. All imported records reference `migration_batch_id` to guarantee rollbacks never delete or corrupt existing library records.
- **Hardware-Neutral Middleware:** Event-driven architecture with a 3000ms sliding-window duplicate suppression filter and Web Audio API sensory feedback.
- **Air-Gapped & Offline Ready:** Zero external cloud dependencies, zero paid microservices, runs entirely on local LAN / standalone workstation (Windows 11, Windows Server 2022+, macOS, Linux).

---

## 2. Technology Stack

- **Backend:** Python 3.12+, FastAPI, Pydantic v2, SQLAlchemy 2.0, Passlib / Bcrypt, python-jose, Uvicorn, Pytest.
- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, Lucide React, Recharts.
- **Database:** SQLite 3 (WAL mode, Foreign Keys ON, Parameterized transactions).
- **Communication:** REST APIs & Server-Sent Events (SSE).

---

## 3. Quickstart & Local Execution

### Prerequisites
- Python 3.11+
- Node.js v18+ & npm

### Backend Setup & Execution
```bash
# 1. Navigate to project root
cd /Users/nagachetanamallipeddi/.gemini/antigravity/scratch/rfid-lms

# 2. Activate virtual environment
source venv/bin/activate

# 3. Seed synthetic database (users, categories, books, copies, members)
python backend/seed_data.py

# 4. Start FastAPI server
uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
```
API Documentation (Swagger UI): `http://127.0.0.1:8000/docs`  
Health Check: `http://127.0.0.1:8000/api/admin/health`

### Frontend Setup & Execution
```bash
# 1. Navigate to frontend directory
cd /Users/nagachetanamallipeddi/.gemini/antigravity/scratch/rfid-lms/frontend

# 2. Start Vite development server
npm run dev
```
Frontend UI will be accessible at: `http://localhost:5173`

---

## 4. Default Seed Credentials & Smart Card Badges

### User Accounts (Username / Password)
- **Administrator:** `admin` / `admin123` (Role: `ADMIN`)
- **Senior Librarian:** `librarian` / `lib123` (Role: `LIBRARIAN`)
- **Desk Officer:** `staff` / `staff123` (Role: `STAFF`)

### Simulated Smart Card Badges (13.56 MHz RFID/NFC Tap)
- **Admin Badge UID:** `SC-ADMIN-001` (One-click login on Login screen)
- **Librarian Badge UID:** `SC-LIB-002`
- **Staff Badge UID:** `SC-STAFF-003`

---

## 5. Automated Test Suite

Run the Batch 1 core automated test suite:
```bash
cd /Users/nagachetanamallipeddi/.gemini/antigravity/scratch/rfid-lms
PYTHONPATH=backend ./venv/bin/pytest backend/tests/test_batch1_core.py -v
```
All 10 tests verify:
- Health and diagnostics endpoints (`/api/admin/health`)
- Password login and JWT issuance
- Smart-card tap authentication (AC07)
- Full-text search and catalog filtering
- Multi-copy accession generation with unique barcodes
- Adding physical copies to existing titles
- Virtual bookshelf grouping
- Member registration, card assignment, and administrative blocking
- Database duplicate constraint rejection
- Dashboard statistical aggregations

---

## 6. Batch Delivery Roadmap

| Batch | Scope & Modules | Status |
| :--- | :--- | :---: |
| **BATCH 1** | Scaffold, WAL DB, Auth/RBAC, Catalog, Copies, Members, Dashboard | **COMPLETED & VERIFIED** |
| **BATCH 2** | Circulation Desk, Fine Rules, RFID Tagging, Reader Simulator, NCIP/SIP2 Mocks | **NEXT IN LINE** |
| **BATCH 3** | Shelf Inventory (Audio), Security Gate & CCTV, SSE Push, 20k Migration & Rollback | Planned |
| **BATCH 4** | Automated Test Suite (AC01–AC10), Backup/Restore, Offline Packaging, D1–D9 Docs | Planned |
