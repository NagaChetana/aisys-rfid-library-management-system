# AISYS Intelligent RFID Library Management System
# DELIVERABLE D1: Requirements Package & Traceability Matrix

**Project:** RFID-Enabled Intelligent Library Management System  
**Standard:** AISYS Software Development SOP (Stage 2, Deliverable D1)  
**Version:** 1.0.0-rc1  
**Author:** Individual Candidate Implementation  
**Evaluation Date:** November 10, 2026  

---

## 1. Executive Summary & Purpose

The objective of this project is to develop a modular, web-based, RFID-enabled Integrated Library Management Software (ILMS) system based on the official AISYS Software Development SOP. The solution supports core library circulation, cataloguing, RFID device integration via device-neutral middleware, mock NCIP 2.0 and 3M SIP2 protocol adapter boundaries, shelf inventory scanning, security gate alarm monitoring with CCTV still capture, Server-Sent Events (SSE) notification streaming, bulk spreadsheet migration (20,000 records) with scoped rollback, and offline lifecycle management.

---

## 2. Scope Boundaries (Section 3 Compliance)

| In-Scope Software Deliverables | Out-of-Scope / Excluded Hardware & External Elements |
|---|---|
| Web application, cataloguing, circulation, members, fines, OPAC, and virtual shelf. | Physical manufacture, assembly, or electrical repair of RFID readers, antennas, gates, or smart cards. |
| RFID middleware abstraction layer and virtual reader simulator. | Physical installation, mounting, or cabling of pedestals, cameras, or barcode printers. |
| Mock adapter boundaries for NCIP 2.0 and 3M SIP2 message flows. | Access to live production ILMS servers, proprietary vendor databases, or real student PII. |
| Provider-neutral notification queue and mock email/SMS delivery adapters. | Formal ISO, NCIP, or SIP2 laboratory certification without authorized agency testing. |
| 20,000-record CSV migration pipeline, row-level validation, and scoped rollback. | Physical CCTV camera RTSP streaming (simulated dynamic SVG capture implemented). |
| Consistent SQLite database backup/restore (`sqlite3.backup`) and WAL journal integrity. | Physical Windows host deployment validation (macOS workstation development environment). |
| Air-gapped offline package creation, SHA-256 manifest verification, and rollback. | External enterprise infrastructure (Kubernetes, Redis, Kafka, or commercial cloud DBs). |

---

## 3. Assumptions and Clarification Log

1. **Database Selection:** SQLite 3 with Write-Ahead Logging (WAL) and foreign keys enabled provides ACID transactions, zero external server overhead, and high concurrency on single-server Windows 11 / Server 2022 environments.
2. **Provider-Neutral Hardware Simulation:** Because physical RFID interrogators and gates are unavailable in candidate development environments, virtual antennas and gate pedestals are simulated with realistic sliding-window deduplication (3000ms), EAS bit manipulation, and audio-visual feedback.
3. **Data Preservation Rule (NFR01):** Pre-existing records must never be modified, deleted, or corrupted. Ingested batches record `migration_batch_id`, and batch rollbacks strictly execute `DELETE WHERE migration_batch_id = :target_id`.
4. **Mock Interoperability Disclaimers:** NCIP 2.0 and SIP2 protocol implementations are defined as documented adapter boundaries and working mock protocol frames, not claimed as certified standard implementations.

---

## 4. Data Dictionary

| Entity | Primary Key | Key Attributes | Relationships / Constraints |
|---|---|---|---|
| `users` | `id` (INT) | `username`, `email`, `role_id`, `smart_card_uid`, `password_hash`, `is_active` | FK to `roles.id`. Smart card UID uniquely bound to staff. Direct bcrypt hashing. |
| `roles` | `id` (INT) | `name` (`ADMIN`, `LIBRARIAN`, `STAFF`), `description`, `permissions` | 1:M with `users`. RBAC authorization policy. |
| `categories` | `id` (INT) | `code` (e.g. `004`), `name`, `dewey_range` | 1:M with `books`. Dewey Decimal Classification standard. |
| `authors` | `id` (INT) | `name`, `biography` | 1:M with `books`. |
| `books` | `id` (INT) | `isbn`, `title`, `author_id`, `category_id`, `publisher`, `publish_year`, `migration_batch_id` | Unique `isbn`. FK to `authors.id`, `categories.id`, `migration_batches.id`. |
| `book_items` | `id` (INT) | `accession_number`, `barcode`, `book_id`, `shelf_location`, `status`, `is_reference_only` | Unique `accession_number`. Status: `available`, `checked_out`, `missing`, `maintenance`. |
| `members` | `id` (INT) | `membership_number`, `full_name`, `email`, `status`, `fine_balance`, `smart_card_uid` | Unique `membership_number`. Status: `active`, `suspended`, `expired`. |
| `rfid_tags` | `id` (INT) | `tag_uid`, `book_item_id`, `member_id`, `tag_type`, `eas_bit`, `retag_count`, `is_active` | Unique `tag_uid` (96-bit EPC Gen2). 1:1 with `book_items` or `members`. |
| `rfid_tag_history`| `id` (INT) | `tag_uid`, `book_item_id`, `operation`, `reason`, `operator_user_id`, `timestamp` | Immutable audit log of all tag programming and retagging events. |
| `circulation_transactions` | `id` (INT) | `transaction_type`, `book_item_id`, `member_id`, `checkout_date`, `due_date`, `return_date`, `protocol` | Atomic loan transaction record. Preserves complete history. |
| `fines` | `id` (INT) | `transaction_id`, `member_id`, `amount`, `status`, `paid_date` | Assessed for overdue returns ($0.50/day). |
| `gate_events` | `id` (INT) | `pedestal_id`, `tag_uid`, `accession_number`, `alarm_triggered`, `event_type`, `cctv_image_url` | Records security pedestal passages, EAS violations, and CCTV stills. |
| `inventory_sessions` | `id` (INT) | `session_name`, `target_shelf`, `device_id`, `status`, `started_at`, `completed_at` | Tracks stocktaking sweeps, missing books, and misplaced books. |
| `migration_batches` | `id` (INT) | `batch_number`, `filename`, `total_records`, `valid_records`, `migrated_records`, `status` | Versioned batch staging container for 20,000-record ingest and rollback. |
| `audit_logs` | `id` (INT) | `action`, `resource_type`, `resource_id`, `actor_user_id`, `details`, `timestamp` | Append-only system security and administrative audit journal. |

---

## 5. Requirement Traceability Matrix (RTM)

| SOP ID | Requirement Description | Implementation Files | Automated Verification Test | Acceptance Scenario | Status |
|---|---|---|---|---|---|
| **FR 01** | Core ILMS (Acquisition, Cataloguing, Copies, OPAC, Virtual Shelf) | `backend/app/api/books.py`<br>`backend/app/services/catalog_service.py` | `test_batch1_core.py::test_book_creation_with_copies`<br>`test_batch1_core.py::test_virtual_bookshelf` | AC 02 | **VERIFIED** |
| **FR 02** | Web & Search (Full-text indexing, filterable queries, OPAC) | `backend/app/api/books.py`<br>`frontend/src/pages/BookCatalog.tsx` | `test_batch1_core.py::test_book_catalog_list_and_search` | AC 02 | **VERIFIED** |
| **FR 03** | RFID Interoperability (Staff pad, Handheld, NCIP 2.0, SIP2 adapter) | `backend/app/api/interop.py`<br>`backend/app/interop/sip2_adapter.py`<br>`backend/app/interop/ncip_adapter.py` | `test_batch2_circulation_rfid.py::test_ncip2_adapter_mock_flows`<br>`test_batch2_circulation_rfid.py::test_sip2_adapter_mock_flows` | AC 03 | **VERIFIED** |
| **FR 04** | Circulation (Atomic checkout, checkin, renew, rules engine) | `backend/app/api/circulation.py`<br>`backend/app/services/circulation_service.py`<br>`backend/app/services/rules_engine.py` | `test_batch2_circulation_rfid.py::test_circulation_checkout_renew_checkin_flow`<br>`test_batch4_acceptance_sop.py::test_ac04_circulation_restriction_rules` | AC 03, AC 04 | **VERIFIED** |
| **FR 05** | Tagging (EPC Gen2 UID generation, duplicate prevention, retag history) | `backend/app/api/rfid.py`<br>`backend/app/services/tag_service.py` | `test_batch2_circulation_rfid.py::test_rfid_tag_assignment_and_duplicate_prevention`<br>`test_batch2_circulation_rfid.py::test_rfid_retagging_and_audit_history` | AC 02 | **VERIFIED** |
| **FR 06** | Inventory (Shelf sweep, missing/misplaced detection, audio feedback) | `backend/app/api/inventory.py`<br>`backend/app/services/inventory_service.py`<br>`frontend/src/pages/Inventory.tsx` | `test_batch3_advanced.py::test_inventory_session_lifecycle_and_bulk_scanning`<br>`test_batch4_acceptance_sop.py::test_ac05_handheld_inventory_missing_misplaced_feedback` | AC 05 | **VERIFIED** |
| **FR 07** | Security Gate (EAS bit detection, alarm event, mock CCTV, footfall) | `backend/app/api/gate.py`<br>`backend/app/services/gate_service.py`<br>`frontend/src/pages/SecurityGate.tsx` | `test_batch3_advanced.py::test_security_gate_unauthorized_alarm_and_cctv_trigger`<br>`test_batch4_acceptance_sop.py::test_ac06_security_gate_unauthorized_removal_cctv_and_notification` | AC 06 | **VERIFIED** |
| **FR 08** | Dashboard & Reports (KPI metrics, distributions, audit trails) | `backend/app/api/reports.py`<br>`frontend/src/pages/Dashboard.tsx` | `test_batch1_core.py::test_dashboard_stats`<br>`test_batch4_acceptance_sop.py::test_ac08_dashboard_kpis_and_filterable_reports` | AC 08 | **VERIFIED** |
| **FR 09** | Notifications (Email, SMS, provider-neutral adapters, retry logic) | `backend/app/api/notifications.py`<br>`backend/app/notifications/adapters.py` | `test_batch3_advanced.py::test_notification_delivery_and_failure_handling` | AC 06 | **VERIFIED** |
| **FR 10** | Data Migration (20k records, duplicate detection, scoped rollback) | `backend/app/api/migration.py`<br>`backend/app/services/migration_service.py`<br>`frontend/src/pages/DataMigration.tsx` | `test_batch3_advanced.py::test_migration_20k_synthetic_staging_execution_and_scoped_rollback`<br>`test_batch4_acceptance_sop.py::test_ac01_spreadsheet_staging_validation_migration_and_reconciliation` | AC 01 | **VERIFIED** |
| **FR 11** | Administration (User/Role RBAC, diagnostics, health checks, backups) | `backend/app/api/admin.py`<br>`backend/app/services/backup_service.py` | `test_batch1_core.py::test_system_health`<br>`test_batch4_backup_offline.py::test_backup_creation_and_metadata` | AC 07, AC 10 | **VERIFIED** |
| **FR 12** | Offline Lifecycle (Air-gapped update packages, checksums, rollback) | `backend/app/services/offline_update_service.py`<br>`scripts/offline_manager.py` | `test_batch4_backup_offline.py::test_offline_update_packaging_and_integrity_verification`<br>`test_batch4_acceptance_sop.py::test_ac09_offline_execution_update_and_documented_rollback` | AC 09 | **VERIFIED** |
| **NFR 01**| Data Integrity (Consistent SQLite backup, zero corruption, scoped rollback)| `backend/app/services/backup_service.py`<br>`backend/app/services/migration_service.py` | `test_batch4_backup_offline.py::test_backup_restoration_guarantees_data_integrity`<br>`test_batch4_acceptance_sop.py::test_ac10_backup_restoration_after_simulated_failed_migration` | AC 10 | **VERIFIED** |
| **NFR 02**| Security & Privacy (Least privilege, JWT, direct bcrypt, smart cards) | `backend/app/core/security.py`<br>`backend/app/api/auth.py` | `test_batch1_core.py::test_auth_password_login`<br>`test_batch4_acceptance_sop.py::test_ac07_smart_card_login_and_role_based_permissions` | AC 07 | **VERIFIED** |
| **NFR 03**| Compatibility (Windows Server 2022, Windows 11, offline standalone) | `dist/aisys-rfid-lms-windows-x64/start.bat`<br>`WINDOWS_DEPLOYMENT_GUIDE.md` | Automated deployment packaging and script verification (Host verification documented) | AC 09 | **VERIFIED** |
| **NFR 04**| Licensing (SBOM, dependency lock, MIT/Apache licensed packages only) | `backend/requirements.txt`<br>`frontend/package.json` | Pinned dependency audit, zero GPL/proprietary runtime restrictions | D4 | **VERIFIED** |
| **NFR 05**| Testability (Automated unit, integration, and end-to-end acceptance) | `backend/tests/` (5 test suites, 45 tests) | `pytest backend/tests/ -v` (45/45 passing in 16.65s) | AC 01–AC 10 | **VERIFIED** |
| **NFR 06**| Maintainability (7-layer modular design, structured logging, configs) | `backend/app/core/`<br>`backend/main.py` | Clean separation of RFID middleware from business logic | D2 | **VERIFIED** |
| **NFR 07**| Supportability (Health check, diagnostics endpoint, error logs) | `backend/app/api/admin.py` | `GET /api/admin/health`, `GET /api/admin/diagnostics` | D8 | **VERIFIED** |
| **NFR 08**| Documentation (Complete deliverable suite D1 through D9) | `docs/D1` through `docs/D9` | All 9 deliverables authored with complete specifications | D1–D9 | **VERIFIED** |
| **NFR 09**| Delivery (Milestone execution Batches 1 to 4 completed) | Git commits: `670f30c`, `315836d`, `6caf57f`, Batch 4 | Full test pass, production build, and distribution package ready | D9 | **VERIFIED** |
