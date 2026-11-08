# AISYS Intelligent RFID Library Management System
# DELIVERABLE D7: Windows Deployment & Offline Operations Manual

**Standard:** AISYS Software Development SOP Section 7 (Deliverable D7) & NFR03  
**Target Environments:** Windows 11 (22H2+), Windows Server 2022 (Datacenter / Standard)  
**Version:** 1.0.0-rc1  
**Author:** Individual Candidate Implementation  

---

## 1. Workstation & Environment Qualification Notice

> [!WARNING]
> **Platform Validation Disclaimer (SOP Requirement 4 & Stage 7):**
> This prototype was developed, built, and tested in a Unix/macOS workstation environment. All application business logic, SQLite WAL database transactions, 45 automated pytest acceptance tests (AC01–AC10), and the Vite production web bundle have been verified.
>
> However, **native Windows execution** (e.g., Windows Registry persistence, Windows Event Viewer integration, NSSM service wrapper behavior, and COM port serial bindings for physical hardware) requires on-site host qualification in the actual Windows Server 2022 / Windows 11 target environment.

---

## 2. Deployment Package Contents (`dist/aisys-rfid-lms-windows-x64/`)

- `backend/`: FastAPI Application Source & Pinned `requirements.txt`
- `frontend_dist/`: Pre-compiled React + Vite single-page application static bundle
- `config/`: Reference `.env.production.example` configuration
- `data/backups/`: Location for PRAGMA integrity-checked database backups
- `data/updates/`: Air-gapped update packages (`packages/`) and snapshots (`snapshots/`)
- `scripts/`: Offline CLI lifecycle manager (`offline_manager.py`)
- `start.bat`: One-click Windows background service launcher
- `stop.bat`: One-click graceful process shutdown
- `init_db.bat`: Offline database initialization and synthetic seed generator
- `VERSION.txt`: Version manifest tracking current deployed release tag

---

## 3. Air-Gapped Installation Walkthrough

No internet connectivity is required.

### Step 1: Install Python Runtime
Install Python 3.12+ (64-bit) from the offline Windows installer (`python-3.12.x-amd64.exe`), checking **"Add Python to PATH"**.

### Step 2: Install Bundled Python Wheels
```cmd
cd aisys-rfid-lms-windows-x64
python -m venv venv
venv\Scripts\activate.bat
pip install --no-index --find-links=wheels -r backend\requirements.txt
```

### Step 3: Initialize Database & Seed
```cmd
init_db.bat
```
Sets up SQLite Write-Ahead Logging (WAL) mode, enables foreign keys, and seeds default staff accounts and catalog entries.

### Step 4: Start the Service
```cmd
start.bat
```
Backend API will be available at `http://127.0.0.1:8000`. Frontend web interface is served from `frontend_dist\index.html` or via local reverse proxy (IIS / Caddy).

---

## 4. Running as a Managed Windows Service (NSSM)

To ensure automatic startup on Windows Server 2022:
```cmd
nssm install AISYS_RFID_LMS "C:\aisys-rfid-lms-windows-x64\venv\Scripts\python.exe"
nssm set AISYS_RFID_LMS AppDirectory "C:\aisys-rfid-lms-windows-x64"
nssm set AISYS_RFID_LMS AppParameters "-m uvicorn backend.main:app --host 0.0.0.0 --port 8000"
nssm set AISYS_RFID_LMS AppStdout "C:\aisys-rfid-lms-windows-x64\data\service_stdout.log"
nssm set AISYS_RFID_LMS AppStderr "C:\aisys-rfid-lms-windows-x64\data\service_stderr.log"
nssm start AISYS_RFID_LMS
```

---

## 5. Offline Update & Rollback Procedures (AC09)

### Applying a Patch:
```cmd
python scripts\offline_manager.py apply-update data\updates\packages\aisys-update-v1.1.0.tar.gz
```
1. Verifies SHA-256 manifest without network calls.
2. Automatically snapshots existing files in `data\updates\snapshots\`.
3. Atomically deploys the update and increments `VERSION.txt`.

### Immediate Rollback:
```cmd
python scripts\offline_manager.py rollback-update
```
Reverts all modified files and version identifiers back to the pre-update snapshot.
