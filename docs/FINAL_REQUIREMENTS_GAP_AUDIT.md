# AISYS Intelligent RFID Library Management System — Gap Audit Matrix
**Document Version:** 1.0.0  
**Baseline Commit:** `d44c2d7`  
**Evaluation Standard:** AISYS Software Development SOP (Candidate Assessment Standard)

---

## 1. Executive Summary

This audit assesses the implemented codebase against the complete set of functional requirements (**FR01–FR12**), non-functional requirements (**NFR01–NFR09**), priority acceptance scenarios (**AC01–AC10**), and mandatory deliverables (**D1–D9**).

While the foundational workflows across Batches 1 to 4 have verified test coverage (48/48 tests passing), specific operational components within the SOP required targeted gap closure. This document defines the exact status of every requirement, identifies remaining gaps, and tracks verification evidence.

---

## 2. Functional Requirements Audit Matrix (FR01–FR12)

| ID | SOP Area & Requirement Specification | Implementation Evidence | Status | Identified Gap / Remaining Work | Test Verification |
|---|---|---|:---:|---|---|
| **FR01** | **Core ILMS**: Acquisition, cataloguing, serials, circulation, OPAC, barcode and spine-label workflows, report generation. | `catalog.py`, `books.py`, `circulation.py`, `VirtualBookshelf.tsx` | **PARTIAL** | 1. Supplier records & Purchase Orders.<br>2. Periodicals/Serials issue receipt.<br>3. Barcode generation (Code128 SVG) & Printable spine labels with Dewey call numbers. | `test_acquisitions_and_serials_lifecycle`, `test_barcode_and_spine_label_generation` |
| **FR02** | **Web and search**: Web interface, full-text search, search engine, real-time indexing, net cataloguing, virtual bookshelf. | `catalog_service.py` (`get_books`), `VirtualBookshelf.tsx`, `BookCatalog.tsx` | **COMPLETE** | Fully implemented: multi-attribute search (title, author, ISBN, call number, category), Dewey-based visual 3D bookshelf. | `test_book_catalog_list_and_search`, `test_virtual_bookshelf` |
| **FR03** | **RFID Interoperability**: Integrate staff station, handheld reader, security gate, smart card, and item tags through middleware. NCIP 2.0 & SIP2 boundary. | `reader_service.py`, `ncip_adapter.py`, `sip2_adapter.py`, `rfid.py` | **PARTIAL** | 1. Reader client activity registry (tracking connected reader hardware: staff pad, handheld, gate, self-checkout with IP/MAC, firmware, health).<br>2. Explicit `BaseRfidReaderAdapter` contract. | `test_reader_client_registry_and_heartbeat` |
| **FR04** | **Circulation**: Check-out, check-in, renewal, due-date enquiry, patron-card personalisation, reference-book restrictions, member blocking, fine limits, role-based rights. | `circulation_service.py`, `rules_engine.py`, `circulation.py`, `Circulation.tsx` | **COMPLETE** | Fully implemented: atomic checkout/checkin/renew, due-date inquiry, reference rule, blocked rule, fine threshold, max loan cap. | `test_circulation_checkout_renew_checkin_flow`, `test_ac04_circulation_restriction_rules` |
| **FR05** | **Tagging**: Validate title/member before tagging/re-tagging. Associate tag with bibliographic/item record. Support tag monitoring. | `tag_service.py`, `rfid.py`, `RfidManagement.tsx` | **PARTIAL** | Tag health monitoring (active, damaged, decommissioned status distribution, EAS integrity tracking). | `test_rfid_tag_health_monitoring` |
| **FR06** | **Inventory**: Stock verification, shelf management, misplaced/missing identification, bulk reading, audible/visible confirmation for handheld. | `inventory_service.py`, `inventory.py`, `Inventory.tsx` | **COMPLETE** | Fully implemented: handheld session lifecycle, bulk EPC scan, shelf reconciliation, audio/visual cues, misplaced detection. | `test_inventory_session_lifecycle_and_bulk_scanning`, `test_ac05_handheld_inventory_missing_misplaced_feedback` |
| **FR07** | **Security Gate Events**: Detect unauthorised/unissued items, read EAS bit offline, record accession, alarm, footfall, CCTV photo, email-notification. | `gate_service.py`, `gate.py`, `SecurityGate.tsx` | **COMPLETE** | Fully implemented: EAS verification, unauthorized alarm, footfall counters, SVG CCTV snapshot generator, security notification queueing. | `test_security_gate_unauthorized_alarm_and_cctv_trigger`, `test_ac06_security_gate_unauthorized_removal_cctv_and_notification` |
| **FR08** | **Dashboard and Reports**: Library usage statistics and reports for tagged items, members, circulation, operator/RFID client activity, fines, gate events. | `reports.py`, `Dashboard.tsx`, `App.tsx` (placeholder) | **PARTIAL** | Filterable reports with date range filtering and CSV export for tagged items, circulation history, member rosters, operator activity, fines, and gate events. | `test_filterable_reports_and_csv_export` |
| **FR09** | **Notifications**: Configurable email, SMS, and print notifications per user through provider-neutral adapters. Delivery queue and retry. | `adapters.py`, `notification_service.py`, `notifications.py` | **PARTIAL** | 1. Provider-neutral `MockPrintAdapter` for circulation receipts and overdue slips.<br>2. Notification queue management and failure retry endpoint. | `test_mock_print_adapter_and_queue_retry` |
| **FR10** | **Data Migration**: Import ~20,000 records from spreadsheet with validation, duplicate handling, error logs, reconciliation, and rollback. | `migration_service.py`, `migration.py`, `DataMigration.tsx` | **COMPLETE** | Fully implemented: staging table, chunked ETL, duplicate resolution, scoped batch rollback, count reconciliation. | `test_migration_20k_synthetic_staging_execution_and_scoped_rollback`, `test_ac01` |
| **FR11** | **Administration**: User and role management, configuration, audit logs, software-version reporting, system health information. | `admin.py`, `AdminViews.tsx`, `setting.py` | **PARTIAL** | Dynamic system settings management API (`GET/PUT /api/admin/settings`) to adjust fine limits, loan durations, and grace periods at runtime. | `test_system_settings_configuration_crud` |
| **FR12** | **Offline Lifecycle**: Offline activation, updates, upgrades, patches, security updates. Installable update package with rollback. | `offline_update_service.py`, `offline_manager.py`, `admin.py` | **COMPLETE** | Fully implemented: air-gapped `.tar.gz` package builder, SHA-256 verification, pre-update snapshot capture, one-click rollback. | `test_offline_update_apply_and_rollback`, `test_ac09` |

---

## 3. Non-Functional & Operational Requirements Audit (NFR01–NFR09)

| ID | SOP Area & Specification | Status | Evidence & Operational Controls |
|---|---|:---:|---|
| **NFR01** | **Data Integrity**: Back up database before integration; never corrupt or delete existing records. | **COMPLETE** | Consistent WAL-safe online backup engine (`backup_service.py`), SHA-256 integrity verification, isolated testing fixtures. |
| **NFR02** | **Security & Privacy**: RBAC, secure secrets, audit logging, input validation, hashed passwords. | **COMPLETE** | SHA-256 JWT tokens, bcrypt password hashing, NFC smart card UID login, unified `AuditLog` table. |
| **NFR03** | **Compatibility**: Windows 11 clients, Windows Server 2022+, Ethernet networking, isolated site. | **COMPLETE** | Standalone Windows distribution in `dist/aisys-rfid-lms-windows-x64/` with batch service scripts and runbook. |
| **NFR04** | **Licensing**: Identified dependencies, pinned versions, licence inventory, redistribution terms. | **COMPLETE** | `requirements.txt`, `package.json`, complete licence audit documented in `docs/D4_Source_Repository_and_Licence_Inventory.md`. |
| **NFR05** | **Testability**: Automated functional, integration, migration, security, regression, UAT evidence. | **COMPLETE** | Comprehensive Pytest suite covering AC01–AC10 and Batches 1–4. |
| **NFR06** | **Maintainability**: Modular adapters, external configuration, structured logs, database migrations. | **COMPLETE** | Clean layered architecture (API, Services, Models, Mocks), `.env` configuration, SQLite WAL mode. |
| **NFR07** | **Supportability**: Diagnostics, health checks, structured logs, incident runbooks. | **COMPLETE** | `/api/admin/health`, `/api/admin/diagnostics`, detailed troubleshooting runbooks in `docs/D8`. |
| **NFR08** | **Documentation**: Architecture, device config, API details, installation, administration, user guides. | **COMPLETE** | Formal deliverable documents D1 through D9 committed in `docs/`. |
| **NFR09** | **Delivery**: Complete candidate exercise from D0 to D10 and identify remaining production backlog. | **COMPLETE** | Complete deliverables package, demonstration scripts, and gap closure. |

---

## 4. Priority Acceptance Scenarios Audit (AC01–AC10)

| ID | Scenario | Status | Automated Test Evidence |
|---|---|:---:|---|
| **AC01** | Spreadsheet staging, duplicate handling, migration & reconciliation | **COMPLETE** | `test_batch4_acceptance_sop.py::test_ac01_spreadsheet_staging_validation_migration_and_reconciliation` |
| **AC02** | Bibliographic item creation, validation, unique RFID tag association | **COMPLETE** | `test_batch4_acceptance_sop.py::test_ac02_bibliographic_item_and_unique_rfid_tag_association` |
| **AC03** | Mocked NCIP / SIP2 circulation flows with transaction history | **COMPLETE** | `test_batch4_acceptance_sop.py::test_ac03_ncip_and_sip2_circulation_flows_with_audit` |
| **AC04** | Circulation business rules: reference book, blocked patron, fine cap | **COMPLETE** | `test_batch4_acceptance_sop.py::test_ac04_circulation_restriction_rules` |
| **AC05** | Handheld RFID inventory: missing, misplaced, audio/visual cues | **COMPLETE** | `test_batch4_acceptance_sop.py::test_ac05_handheld_inventory_missing_misplaced_feedback` |
| **AC06** | Security gate alarm, accession logging, CCTV snapshot, email queue | **COMPLETE** | `test_batch4_acceptance_sop.py::test_ac06_security_gate_unauthorized_removal_cctv_and_notification` |
| **AC07** | Staff smart card login and role-based permissions | **COMPLETE** | `test_batch4_acceptance_sop.py::test_ac07_smart_card_login_and_role_based_permissions` |
| **AC08** | Dashboard KPIs and filterable reports | **COMPLETE** | `test_batch4_acceptance_sop.py::test_ac08_dashboard_kpis_and_filterable_reports` |
| **AC09** | Offline application lifecycle, update package, and rollback | **COMPLETE** | `test_batch4_acceptance_sop.py::test_ac09_offline_execution_update_and_documented_rollback` |
| **AC10** | Database restoration after simulated failure with data integrity | **COMPLETE** | `test_batch4_acceptance_sop.py::test_ac10_backup_restoration_after_simulated_failed_migration` |

---

## 5. Mandatory Deliverables Audit (D1–D9)

| ID | Deliverable Package | Document Location | Status |
|---|---|---|:---:|
| **D1** | Requirements Traceability Package | `docs/D1_Requirements_Traceability_Package.md` | **COMPLETE** |
| **D2** | System Architecture Specification | `docs/D2_System_Architecture_Specification.md` | **COMPLETE** |
| **D3** | Working Prototype Manual | `docs/D3_Working_Prototype_Manual.md` | **COMPLETE** |
| **D4** | Source Repository and Licence Inventory | `docs/D4_Source_Repository_and_Licence_Inventory.md` | **COMPLETE** |
| **D5** | Relational Database & Migration Specification | `docs/D5_Relational_Database_and_Migration_Specification.md` | **COMPLETE** |
| **D6** | Test Strategy and Acceptance Report | `docs/D6_Test_Strategy_and_Acceptance_Report.md` | **COMPLETE** |
| **D7** | Windows Deployment & Offline Operations | `docs/D7_Windows_Deployment_and_Offline_Operations.md` | **COMPLETE** |
| **D8** | Operational Administrator & User Guide | `docs/D8_Operational_Administrator_and_User_Guide.md` | **COMPLETE** |
| **D9** | Executive Demonstration Script | `docs/D9_Executive_Demonstration_Script.md` | **COMPLETE** |

---

## 6. Action Plan for Immediate Gap Implementation

To bring all requirements to 100% completeness:

1. **Module 1 — Acquisitions & Serials (FR01):**
   - Add `Supplier`, `PurchaseOrder`, `PurchaseOrderItem`, `SerialSubscription`, `SerialIssue` database tables and schemas.
   - Implement `/api/acquisitions` endpoints for vendor management, purchase ordering, and periodical receiving.
2. **Module 2 — Barcode & Spine-Label Printing Engine (FR01):**
   - Implement `label_service.py` with Code128 SVG barcode rendering and printable spine-label layouts (Dewey call number, Cutter number, accession).
   - Add `/api/books/items/{accession}/barcode` and `/api/books/items/{accession}/spine-label` endpoints.
3. **Module 3 — Reader Client Activity Registry & Tag Health (FR03, FR05):**
   - Implement `BaseRfidReaderAdapter` contract.
   - Add reader device registry (`STAFF-PAD-01`, `HANDHELD-READER-01`, `GATE-EAST-01`) tracking IP, firmware, status, and last heartbeat.
   - Add tag health monitoring endpoint `/api/rfid/tags/health`.
4. **Module 4 — Comprehensive Filterable Reports & CSV Export (FR08):**
   - Implement `/api/reports/circulation`, `/api/reports/tagged-items`, `/api/reports/members`, `/api/reports/operator-activity`, `/api/reports/fines`, `/api/reports/gate-events` with query filters and CSV export.
   - Build `ReportsView.tsx` in frontend replacing the placeholder card.
5. **Module 5 — Provider-Neutral Print Adapter & Notification Queue (FR09):**
   - Implement `MockPrintAdapter` in `adapters.py`.
   - Add `/api/notifications/queue` and retry endpoint `/api/notifications/{id}/retry`.
6. **Module 6 — Dynamic System Settings API & UI (FR11):**
   - Implement `GET /api/admin/settings` and `PUT /api/admin/settings` in `admin.py`.
   - Update `SystemSettingsView` in `AdminViews.tsx` with editable fields and live saving.
7. **Module 7 — Comprehensive Automated Verification Suite:**
   - Create `backend/tests/test_batch5_gap_completion.py` testing all new functional workflows.
   - Verify frontend production build and preserve all existing 48 tests.
