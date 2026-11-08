# AISYS Intelligent RFID Library Management System
# DELIVERABLE D8: Operational, Administrator & User Guide

**Standard:** AISYS Software Development SOP Section 7 (Deliverable D8) & NFR07, NFR08  
**Version:** 1.0.0-rc1  
**Author:** Individual Candidate Implementation  

---

## 1. User & Staff Guide

### 1.1 Logging In
- **Password Authentication:** Enter username and password (`admin` / `admin123`) on the login screen.
- **Smart Card Quick-Tap:** On the login screen, click any of the 3 pre-registered simulated badges:
  - `Sarah Connor (SC-ADMIN-001)` — System Administrator
  - `John Doe (SC-LIB-002)` — Senior Librarian
  - `Emma Watson (SC-STAFF-003)` — Circulation Desk Staff

### 1.2 Circulation Desk Operations
- **Borrowing Books:**
  1. Navigate to **Circulation Desk**.
  2. Enter the patron's **Membership ID** (e.g. `MEM-00001`).
  3. Enter or scan the book's **Accession Number** (e.g. `ACC-000004`).
  4. Click **Process Checkout**. The loan is created atomically and the RFID tag's EAS security bit is automatically set to disarmed (`eas_bit = False`).
- **Returning Books:**
  1. Switch to the **Check In / Return** tab.
  2. Enter the accession number and click **Process Return**.
  3. If the item is overdue, overdue fines ($0.50/day) are assessed automatically. The EAS security bit is re-armed (`eas_bit = True`).
- **Renewing Loans:**
  1. Switch to the **Renewal** tab.
  2. Enter the accession number. If loan is eligible and renewal count < 2, the loan due date is extended by 14 days.

### 1.3 RFID Tag Encoding & Management
- **Tagging New Physical Copies:**
  1. Navigate to **RFID Management**.
  2. Select an untagged physical copy from the catalog list.
  3. Click **Auto-Generate & Encode Tag**. A compliant 96-bit EPC Gen2 tag UID (e.g. `E2801160...`) is generated and linked.
- **Retagging Damaged Tags:**
  1. Click **Retag** on any existing item.
  2. Select a replacement reason (e.g. *Damaged Tag*, *Transponder Malfunction*).
  3. The system assigns a new tag UID and logs the operation to `rfid_tag_history`.

### 1.4 Shelf Inventory Operations
1. Navigate to **Shelf Inventory**.
2. Select the target shelf location (e.g. `CS-SHELF-01`).
3. Click **Start Inventory Session**.
4. Use the **Sweep Scanner** to read tags. The system provides immediate visual and audio feedback:
   - High chime (880 Hz): Book is correctly placed.
   - Low buzz (220 Hz): Book is misplaced (belongs on another shelf).
5. Click **Complete Inventory Session** to view the missing books reconciliation report.

### 1.5 Security Gate Monitoring
1. Open the **Security Gate** page.
2. The display simulates dual pedestals (`GATE-EAST-PED-01` and `GATE-EAST-PED-02`).
3. When an unauthorized item (armed EAS bit) passes through:
   - The visual siren alerts red.
   - The footfall counter increments.
   - An incident record is written with accession number and timestamp.
   - A mock CCTV snapshot is captured and viewable via the modal button.
   - An email notification is queued in the system outbox.

---

## 2. Administrator Guide & Troubleshooting Runbook

### 2.1 Database Backup & Disaster Recovery
- **Creating a Backup via UI:** Navigate to **Administration** &rarr; **Database Backups** &rarr; click **Create Consistent Backup**.
- **Creating a Backup via CLI:**
  ```bash
  python scripts/offline_manager.py backup --note "Daily Maintenance Snapshot"
  ```
- **Restoring a Backup:**
  ```bash
  python scripts/offline_manager.py restore-backup library_backup_YYYYMMDD_HHMMSS.db
  ```

### 2.2 System Health & Diagnostics Endpoints
- **Health Check:** `GET /api/admin/health`  
  Returns database connectivity status, SQLite WAL file size, and available disk capacity.
- **Diagnostics:** `GET /api/admin/diagnostics`  
  Returns table counts and verifies `PRAGMA integrity_check`.

### 2.3 Troubleshooting Common Scenarios

| Incident Symptom | Probable Cause | Corrective Action |
|---|---|---|
| Checkout rejected with "Reference Only". | Copy has `is_reference_only = True`. | Reference copies cannot circulate; borrow circulating copies. |
| Checkout rejected with "Fine Balance Exceeded". | Patron's unpaid fines > $15.00 limit. | Navigate to member record and settle outstanding fines before borrowing. |
| Port 8000 already in use error on startup. | Another local Python process is bound to 8000. | Terminate conflicting process via `lsof -i :8000` or specify alternative port. |
| Database busy or locked error. | SQLite WAL checkpoint backlog. | The system configures `PRAGMA busy_timeout = 5000;`. Verify no external tools have locked `library.db`. |
