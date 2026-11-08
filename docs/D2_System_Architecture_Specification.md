# AISYS Intelligent RFID Library Management System
# DELIVERABLE D2: System Architecture Specification

**Standard:** AISYS Software Development SOP Section 6 (Architecture)  
**Version:** 1.0.0-rc1  
**Author:** Individual Candidate Implementation  
**Status:** Approved & Verified  

---

## 1. Architectural Strategy & Design Principles

The AISYS RFID Intelligent LMS is engineered using a strict **Seven-Layer Modular Architecture**. Hardware interrogator communication and low-level protocol framing are completely decoupled from core library circulation and cataloguing services.

```
+-------------------------------------------------------------------------------+
| 1. USER LAYER                                                                 |
| React 18 + TypeScript + Vite + Tailwind CSS + Lucide Icons + Recharts         |
| [Executive Dashboard] [OPAC / Catalog] [Circulation] [RFID Studio] [Gate HUD] |
+-------------------------------------------------------------------------------+
                                      | REST APIs (JSON) & Server-Sent Events (SSE)
                                      v
+-------------------------------------------------------------------------------+
| 2. APPLICATION LAYER                                                          |
| FastAPI Services (Catalog, Members, Circulation, Rules Engine, Inventory)     |
+-------------------------------------------------------------------------------+
           |                                                   |
           v                                                   v
+------------------------------------+  +---------------------------------------+
| 3. RFID MIDDLEWARE                 |  | 4. INTEROPERABILITY LAYER             |
| Device-Neutral Interrogator Engine |  | Mock 3M SIP2 Adapter (Frame Checksums)|
| Sliding-Window Dedup (3000ms)      |  | Mock NCIP 2.0 XML / REST Gateway      |
| Virtual Staff Pad / Handheld Gun   |  | ILMS Integration Protocol Boundary    |
+------------------------------------+  +---------------------------------------+
           \                                                   /
            -------------------------+-------------------------
                                     |
                                     v
+-------------------------------------------------------------------------------+
| 5. DATA LAYER                                                                 |
| SQLite 3 (WAL Mode, Foreign Key Constraints, Atomic Multi-Table Transactions) |
| Staging Area, Audit Trail Journal, SQLite Online Backup Service               |
+-------------------------------------------------------------------------------+
           |                                                   |
           v                                                   v
+------------------------------------+  +---------------------------------------+
| 6. INTEGRATION LAYER               |  | 7. OPERATIONS LAYER                   |
| Provider-Neutral Notification Queue|  | Health & Diagnostics Service          |
| Mock Email (SMTP) & SMS Adapters   |  | Offline Lifecycle & SHA-256 Packaging |
| Mock Dynamic SVG CCTV Camera Gen   |  | Immutable Snapshots & Rollback Engine |
+------------------------------------+  +---------------------------------------+
```

---

## 2. Detailed Layer Specifications

### Layer 1: User Layer
- **Technology:** React 18, TypeScript 5.5, Vite 5.4, Tailwind CSS 3.4, Recharts, Lucide React.
- **Components:**
  - `Dashboard.tsx`: High-level executive statistics, real-time SSE stream notifications, category distribution charts, and recent activity ledger.
  - `BookCatalog.tsx`: Comprehensive bibliographic acquisition, shelf location tracking, physical copies inspection, and Dewey classification.
  - `Circulation.tsx`: Interactive checkout, return, and renewal terminal with atomic transaction feedback and policy rule violation banners.
  - `RfidManagement.tsx`: EPC Gen2 tag encoding studio, retagging audit trail inspection, and antenna pad monitoring.
  - `RfidSimulator.tsx`: Virtual RFID antenna pad, smart card credential tapper, and deduplication monitor.
  - `Inventory.tsx`: Handheld stocktaking simulator with Web Audio API synthetic chime/buzz cues and missing book resolution.
  - `SecurityGate.tsx`: Live dual-pedestal security gate monitor with siren alert flash, footfall counter, and dynamic CCTV snapshot modal.
  - `DataMigration.tsx`: 20,000-record spreadsheet staging manager, error grid, and scoped rollback console.
  - `AdminViews.tsx`: User and role management, database backup/restore manager, and offline package upgrade/rollback portal.

### Layer 2: Application Layer
- **Circulation Engine (`circulation_service.py`):** Executes atomic database transactions across `book_items`, `members`, and `circulation_transactions`.
- **Rules Engine (`rules_engine.py`):** Pre-evaluates 4 cardinal circulation constraints before permitting a checkout:
  1. *Reference-Only Restriction:* Rejects reference items (`is_reference_only == True`).
  2. *Member Status Restriction:* Rejects blocked or suspended patrons (`member.status != 'active'`).
  3. *Fine Ceiling Restriction:* Rejects patrons whose unpaid fine balance exceeds the configurable limit (`$15.00`).
  4. *Concurrent Loan Restriction:* Rejects copies already on active loan (`copy.status != 'available'`).

### Layer 3: RFID Middleware Layer
- **Tag Encoding (`tag_service.py`):** Generates standards-aligned 96-bit EPC Gen2 hex strings prefixed with `E280` followed by 8-digit accession identifiers. Validates format against regex `^[A-Fa-f0-9]{24}$`.
- **Sliding-Window Deduplication (`deduplication.py`):** Implements an in-memory TTL cache keyed by `(reader_id, tag_uid)`. Consecutive reads within `3000ms` are suppressed to prevent duplicate event spamming.
- **Hardware Simulation (`reader_service.py`):** Simulates multi-antenna desktop reader pads and handheld RFID wands.

### Layer 4: Interoperability Layer
- **3M SIP2 Protocol Boundary (`sip2_adapter.py`):** Decodes raw ASCII SIP2 packets. Validates optional 2's complement checksums. Supports:
  - Message 63 &rarr; 64: Patron Status Request / Response
  - Message 11 &rarr; 12: Checkout Request / Response (updates loan status, toggles EAS bit)
  - Message 09 &rarr; 10: Checkin Request / Response (assesses fines, resensitizes EAS bit)
  - Message 29 &rarr; 30: Renew Request / Response
- **NCIP 2.0 Adapter Boundary (`ncip_adapter.py`):** Provides a clean translation boundary for NCIP messages:
  - `LookupUser`: Queries patron eligibility and loan balance.
  - `CheckoutItem`: Dispatches atomic checkout transaction.
  - `CheckinItem`: Processes item return.
  - `RenewItem`: Extends due date by configured renewal increment.

### Layer 5: Data Layer
- **Database Engine:** SQLite 3 with Write-Ahead Logging (`PRAGMA journal_mode=WAL;`), synchronous normal (`PRAGMA synchronous=NORMAL;`), and foreign keys enforced (`PRAGMA foreign_keys=ON;`).
- **Data Preservation Architecture (NFR01):** The database guarantees zero record deletion during rollbacks. Ingested batches carry foreign keys to `migration_batches.id`, permitting surgical deletion strictly where `migration_batch_id == target_id`.
- **Online Backup Engine (`backup_service.py`):** Uses `sqlite3.Connection.backup()` to stream point-in-time, non-blocking snapshots into `data/backups/`, verified immediately using `PRAGMA integrity_check`.

### Layer 6: Integration Layer
- **Provider-Neutral Notification Queue (`notification_service.py`):** Asynchronous dispatch queue supporting email and SMS. Includes configurable retry logic (up to 3 attempts with failure error capture).
- **Simulated CCTV Still Capture (`gate_service.py`):** Upon security gate EAS alarm violation, dynamically synthesizes an SVG forensic security snapshot with HUD timestamp, pedestal ID, camera framing, and detected tag UID.

### Layer 7: Operations Layer
- **Health Checks (`/api/admin/health`):** Real-time monitoring of database connectivity, WAL journal file sizes, and disk capacity.
- **Diagnostics (`/api/admin/diagnostics`):** Comprehensive table counts, SQLite `PRAGMA integrity_check`, and business rule parameters.
- **Air-Gapped Offline Lifecycle (`offline_update_service.py`):** Packages updates into `.tar.gz` archives with SHA-256 manifests. Captures immutable pre-update snapshots in `data/updates/snapshots/` to enable instantaneous one-click rollback.
