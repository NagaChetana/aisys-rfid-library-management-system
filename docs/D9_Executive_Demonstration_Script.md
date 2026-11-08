# AISYS Intelligent RFID Library Management System
# DELIVERABLE D9: Executive Demonstration Script & Prototype Walkthrough

**Standard:** AISYS Software Development SOP Section 7 (Deliverable D9) & Section 8 (AC01–AC10)  
**Version:** 1.0.0-rc1  
**Author:** Individual Candidate Implementation  
**Estimated Demonstration Duration:** 12–15 minutes  

---

## 1. Demonstration Setup & Prerequisites

1. **Backend Server Running:**
   ```bash
   cd ~/.gemini/antigravity/scratch/rfid-lms
   PYTHONPATH=backend ./venv/bin/uvicorn backend.main:app --host 127.0.0.1 --port 8000
   ```
2. **Frontend Running:**
   ```bash
   cd ~/.gemini/antigravity/scratch/rfid-lms/frontend
   npm run dev
   ```
3. Open browser to `http://localhost:5173/`.

---

## 2. Step-by-Step Demonstration Walkthrough

### Scenario 1: Staff Smart Card Authentication & Executive Dashboard (AC07, AC08)
1. Navigate to `http://localhost:5173/`.
2. Demonstrate simulated **Smart Card Tap Authentication**:
   - Click the green button **Sarah Connor (SC-ADMIN-001)**.
   - Observe instantaneous authentication without passwords, returning an authenticated JWT token stamped with role `ADMIN`.
3. Review the **Executive Dashboard**:
   - Point out real-time KPI tiles: Total Titles, Physical Copies, RFID Tag Coverage %, Active Loans, and Gate Alarms.
   - Point out the Dewey Category Distribution and Shelf Allocation charts.
   - Explain the live Server-Sent Events (SSE) notification ticker at the top of the screen.

### Scenario 2: Bibliographic Acquisition & RFID Tag Encoding (AC02, FR01, FR05)
1. Click **Catalog & Books** in the left sidebar.
2. Search for `Modern Approach` to demonstrate instant full-text filtering.
3. Click **Add New Title** to create a new book:
   - ISBN: `978-0134494166`
   - Title: `Cloud Architecture Patterns`
   - Author: `Bill Wilder`
   - Category: `004 (Computer Science & Artificial Intelligence)`
   - Copies: `2`
   - Shelf: `CS-SHELF-01`
4. Navigate to **RFID Studio**:
   - Locate the newly created physical copies.
   - Click **Encode Tag** on Copy 1.
   - Show the generated 96-bit EPC Gen2 tag UID (`E2801160...`) and the armed EAS security bit (`EAS = Armed`).
   - Click **Retag** to demonstrate replacement transponder programming with an immutable audit log in `rfid_tag_history`.

### Scenario 3: Interoperability Circulation & Rules Enforcement (AC03, AC04)
1. Open **Circulation Desk**.
2. **Standard Checkout (AC03):**
   - Enter Patron `MEM-00001` (Alice Smith) and Accession `ACC-000004`.
   - Click **Process Checkout**.
   - Show atomic transaction completion, due date set 14 days out, and EAS bit disarmed (`EAS = False`).
3. **Reference Book Restriction (AC04):**
   - Try to check out `ACC-000001` (Clean Architecture - Reference Copy).
   - Observe immediate rejection: *"Checkout blocked: Copy is designated as Reference Only."*
4. **Blocked Member Restriction (AC04):**
   - Try to check out with `MEM-00002` (Bob Jones - Suspended Member).
   - Observe immediate rejection: *"Borrowing privileges suspended."*
5. **Fine Limit Restriction (AC04):**
   - Try to check out with `MEM-00003` (Charlie Brown - Fine balance $18.50 > $15.00 limit).
   - Observe immediate rejection: *"Outstanding fine balance exceeds $15.00 limit."*

### Scenario 4: Handheld Shelf Inventory & Audio Feedback (AC05)
1. Open **Shelf Inventory**.
2. Start an inventory session targeting shelf `CS-SHELF-01`.
3. Click **Simulate Wand Sweep**:
   - Listen to the high chime (880 Hz) as correctly shelved books are detected.
   - Listen to the low alert buzz (220 Hz) as a misplaced book is detected.
4. Click **Complete Inventory Session**:
   - Review the missing books report highlighting physical copies that were expected on the shelf but not detected.

### Scenario 5: Security Gate EAS Alarm & CCTV Capture (AC06)
1. Open **Security Gate**.
2. Click **Simulate Unauthorized Passage** with an unissued book (EAS bit armed).
3. Observe:
   - The visual alarm siren flashes red.
   - The footfall counter increments.
   - Accession number and timestamp are logged.
   - Click **View Forensic CCTV Still** to view the dynamic SVG capture with timestamp HUD overlay.
   - Show that an incident notification was dispatched to the email outbox.

### Scenario 6: 20,000-Record Ingest & Scoped Rollback (AC01, FR10, NFR01)
1. Open **Data Migration**.
2. Click **Generate 20,000 Synthetic Records**.
3. View the validation report: 19,900 valid records, 100 invalid records identified and quarantined with row-level error reasons.
4. Click **Execute Migration**:
   - Watch the high-speed chunked ingestion process complete in ~3 seconds.
5. Click **Perform Scoped Rollback**:
   - Observe that exactly the 19,900 records created by this batch are deleted.
   - Confirm that all pre-existing baseline books and members remain 100% intact.

### Scenario 7: Disaster Recovery & Air-Gapped Lifecycle (AC09, AC10)
1. Open **Administration** &rarr; **Database Backups**.
2. Click **Create Consistent Backup**:
   - Point out the generated `.db` snapshot, SHA-256 hash, and PRAGMA integrity check result ("ok").
3. Explain the air-gapped update and snapshot rollback mechanism demonstrated by automated test `test_ac09_offline_execution_update_and_documented_rollback`.

---

## 3. Known Limitations & Production Completion Backlog

| Area | Current Candidate Prototype Status | Production Completion Backlog Item |
|---|---|---|
| **Physical Interrogators** | Simulated via software middleware and virtual desktop/handheld pad. | Integrate vendor-specific C/C++ or Python SDKs (e.g. Impinj Octane SDK, ThingMagic Mercury API). |
| **SIP2 / NCIP Standards** | Documented adapter boundaries and working mock protocol flows. | Full conformance testing and official 3M / ISO certification. |
| **CCTV Surveillance** | Dynamically synthesized SVG vector still images with HUD overlays. | Connect to physical RTSP / ONVIF IP camera streams with OpenCV frame capture. |
| **Host OS Validation** | Developed and tested in Unix/macOS environment. | On-site Windows Server 2022 hardware qualification, Windows Event Log service integration. |
