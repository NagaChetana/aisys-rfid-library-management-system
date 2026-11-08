# AISYS Intelligent RFID Library Management System
# DELIVERABLE D3: Working Prototype Evidence & Manual

**Standard:** AISYS Software Development SOP Section 7 (Deliverable D3)  
**Version:** 1.0.0-rc1  
**Author:** Individual Candidate Implementation  
**Status:** Runnable & Verified  

---

## 1. Prototype Overview

The AISYS RFID Intelligent LMS prototype is a fully functioning, end-to-end web application with a FastAPI backend and a React + TypeScript frontend. It demonstrates all core workflows specified in the candidate SOP without relying on static mockups.

### Implemented Modules & Capabilities
1. **Executive Dashboard (`Dashboard.tsx`):**
   - KPI metrics: total catalog titles, copies, tag coverage percentage, active loans, overdue fines, and gate alarms.
   - Real-time Server-Sent Events (SSE) notification ticker for live circulation, RFID scans, and security gate violations.
   - Dewey category distribution bar charts and shelf location allocation charts using Recharts.
2. **Bibliographic Cataloguing & Physical Copies (`BookCatalog.tsx`):**
   - Book acquisition with ISBN-10/13 validation, title, author, category, publisher, and year.
   - Distinct physical copy generation with sequential accession numbers (`ACC-000001`+), barcodes, shelf locations, and reference-only flags.
   - Virtual Bookshelf browser grouped by Dewey category code.
3. **Patron Membership & Smart Card Binding (`Members.tsx`):**
   - Patron registration with membership IDs (`MEM-00001`+), loan limits, and email.
   - Smart card NFC UID assignment (13.56 MHz ISO 14443A simulated UID).
   - Administrative member suspension and blocking controls.
4. **Circulation Desk & Rules Engine (`Circulation.tsx`):**
   - Atomic checkout, return, and renewal operations.
   - Automated enforcement of business constraints: reference-only items, suspended members, fine balance ceiling ($15.00), and duplicate loan prevention.
   - Real-time fine assessment calculation ($0.50/day overdue).
5. **RFID Tagging & History Studio (`RfidManagement.tsx`):**
   - EPC Gen2 96-bit hexadecimal tag encoding (`E280` prefix).
   - Electronic Article Surveillance (EAS) security bit manipulation.
   - Retagging manager with immutable audit trail preservation in `rfid_tag_history`.
6. **Virtual Hardware Simulator (`RfidSimulator.tsx`):**
   - Multi-antenna desktop staff pad scanner with 3000ms sliding-window deduplication.
   - Smart card tapper simulating staff badge authentication.
7. **Handheld Shelf Inventory (`Inventory.tsx`):**
   - Stocktaking audit session creation by target shelf location.
   - Bulk RFID scanning with Web Audio API audible cues (880 Hz chime for correctly located, 220 Hz alert for misplaced books).
   - Missing book reconciliation report on session completion.
8. **RFID Security Gate HUD & CCTV (`SecurityGate.tsx`):**
   - Dual-pedestal gate passage simulator.
   - EAS armed bit detection triggering visual siren alerts and footfall counters.
   - Simulated dynamic SVG CCTV forensic snapshot generator with timestamped camera overlays.
9. **Data Migration Studio (`DataMigration.tsx`):**
   - 20,000-record synthetic CSV generator and custom file upload.
   - Pre-validation staging with row-level error reporting (duplicate ISBNs, malformed fields).
   - Chunked atomic ingestion (2,000 rows/flush) and scoped rollback deleting only batch-tagged records.
10. **Administration & Health (`AdminViews.tsx`):**
    - Staff user management and RBAC role assignment.
    - SQLite online backup creation and one-click database restore.
    - Air-gapped offline package installer and snapshot rollback manager.

---

## 2. Distinction Between Implemented Software & Simulated Hardware

> [!NOTE]
> To preserve engineering integrity and comply with Section 3 and Section 5 of the AISYS SOP, the prototype distinguishes simulated device adapters from real physical appliances:
>
> - **Desktop Staff Reader & Handheld RFID Scanner:** Implemented via device-neutral middleware software adapters (`reader_service.py`, `deduplication.py`). Communication protocols mimic standard LLRP / serial vendor frames. Physical RFID antenna hardware is simulated.
> - **Smart Cards:** Authentication uses standard SHA-256 JWT tokens. Smart card UIDs are simulated via mock credential providers (`SC-ADMIN-001`, `SC-LIB-002`, `SC-STAFF-003`).
> - **Security Gate Pedestals:** EAS armed/disarmed bit checking and footfall detection are executed in software (`gate_service.py`).
> - **CCTV Surveillance:** Security still captures are dynamically synthesized in SVG vector format with camera HUD metadata; physical RTSP IP cameras are not connected.
> - **NCIP 2.0 & 3M SIP2 Interoperability:** Documented protocol boundaries and working mock message flows are provided (`sip2_adapter.py`, `ncip_adapter.py`). Formal standards compliance certification is not claimed.
