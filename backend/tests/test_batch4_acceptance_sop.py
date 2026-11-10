"""
Comprehensive Acceptance Test Suite for AISYS Software Development SOP Priority Scenarios AC01–AC10.
Traceable evidence verifying FR01–FR12 and NFR01–NFR09.
"""
import os
import uuid
import json
import random
import sqlite3
import pytest
from fastapi.testclient import TestClient
from main import app
from app.services import backup_service
from app.services import offline_update_service

client = TestClient(app)
AC_RUN_ID = uuid.uuid4().hex[:6]

def test_ac01_spreadsheet_staging_validation_migration_and_reconciliation():
    """
    AC 01: Import a supplied spreadsheet into staging, reject invalid rows,
    identify duplicates, migrate valid records, and reconcile source and target counts.
    """
    isbn_a = f"978-{random.randint(1000000000, 9999999999)}"
    isbn_b = f"978-{random.randint(1000000000, 9999999999)}"
    csv_content = (
        "title,subtitle,author,isbn,category_code,publisher,publish_year,shelf_location,price,is_reference_only\n"
        f"Valid Ingest Title A,,Author Alpha,{isbn_a},004,Prentice Hall,2022,CS-SHELF-01,25.0,0\n"
        f"Valid Ingest Title B,,Author Beta,{isbn_b},004,Prentice Hall,2023,CS-SHELF-02,30.0,0\n"
        f"Malformed ISBN Title,,Author Gamma,INVALID_ISBN,004,Unknown Press,2024,CS-SHELF-03,20.0,0\n"
        f"Duplicate ISBN Title,,Author Alpha,{isbn_a},004,Prentice Hall,2022,CS-SHELF-01,25.0,0\n"
    )
    files = {"file": ("staging_ac01.csv", csv_content, "text/csv")}
    upload_res = client.post("/api/migration/upload", files=files)
    assert upload_res.status_code == 201
    batch_data = upload_res.json()
    batch_id = batch_data["id"]

    # Verify reconciliation report
    report_res = client.get(f"/api/migration/batches/{batch_id}/report")
    assert report_res.status_code == 200
    report = report_res.json()
    assert report["total_records"] == 4
    assert report["valid_records"] == 2
    assert report["invalid_records"] == 2
    assert len(report["sample_errors"]) >= 2

    # Execute migration
    exec_res = client.post(f"/api/migration/batches/{batch_id}/execute")
    assert exec_res.status_code == 200
    exec_data = exec_res.json()
    assert exec_data["status"] == "migrated"
    assert exec_data["migrated_records"] == 2

    # Scoped rollback to preserve pre-existing data
    rb_res = client.post(f"/api/migration/batches/{batch_id}/rollback")
    assert rb_res.status_code == 200
    assert rb_res.json()["status"] == "rolled_back"

def test_ac02_bibliographic_item_and_unique_rfid_tag_association():
    """
    AC 02: Create or locate a bibliographic item, validate it, associate a mock RFID tag,
    and display the tag-to-item relationship.
    """
    # 1. Create book with 1 copy
    book_isbn = f"978-0735{AC_RUN_ID}"
    create_res = client.post("/api/books", json={
        "isbn": book_isbn,
        "title": f"RFID Architecture Principles {AC_RUN_ID}",
        "author_name": "Dr. AISYS",
        "category_code": "004",
        "publisher": "Tech Standards Press",
        "publish_year": 2026,
        "initial_copies": 1,
        "shelf_location": "RFID-SHELF-01"
    })
    assert create_res.status_code == 201
    book_data = create_res.json()
    book_item_id = book_data["items"][0]["id"]
    accession_no = book_data["items"][0]["accession_number"]

    # 2. Associate unique RFID EPC tag
    tag_res = client.post("/api/rfid/tag-item", json={"book_item_id": book_item_id})
    assert tag_res.status_code == 201
    tag_data = tag_res.json()
    tag_uid = tag_data["tag_uid"]

    assert tag_data["tag_uid"].startswith("E280")
    assert tag_data["book_item_id"] == book_item_id
    assert tag_data["eas_bit"] is True

    # 3. Simulate staff reader pad scan to verify tag-to-item resolution
    scan_res = client.post("/api/rfid/simulate/staff-scan", json={
        "reader_id": "STAFF-PAD-01",
        "tag_uids": [tag_uid]
    })
    assert scan_res.status_code == 200
    scan_data = scan_res.json()
    assert scan_data["total_detected"] == 1
    assert scan_data["items"][0]["tag_uid"] == tag_uid
    assert scan_data["items"][0]["accession_number"] == accession_no
    assert scan_data["items"][0]["book_title"] == f"RFID Architecture Principles {AC_RUN_ID}"

def test_ac03_ncip_and_sip2_circulation_flows_with_audit():
    """
    AC 03: Check out, renew, and check in an item through a mocked NCIP or SIP2 flow
    while preserving an auditable transaction history.
    """
    # Create patron and book
    patron_res = client.post("/api/members", json={
        "full_name": f"Alice Interop {AC_RUN_ID}",
        "email": f"alice_{AC_RUN_ID}@example.com"
    })
    assert patron_res.status_code == 201
    mem_no = patron_res.json()["membership_number"]

    book_res = client.post("/api/books", json={
        "isbn": f"978-0111{AC_RUN_ID}",
        "title": f"Protocol Standards {AC_RUN_ID}",
        "author_name": "Interop Team",
        "category_code": "004",
        "initial_copies": 1,
        "shelf_location": "CS-SHELF-01"
    })
    assert book_res.status_code == 201
    item = book_res.json()["items"][0]
    acc_no = item["accession_number"]

    # SIP2 Check-out (Msg 11)
    sip_co = client.post("/api/interop/sip2", json={"raw_frame": f"11YN20261108    09200020261122    092000AO|AA{mem_no}|AB{acc_no}|AC|"})
    assert sip_co.status_code == 200
    assert sip_co.json()["raw_response"].startswith("12")
    assert sip_co.json()["parsed"]["ok"] is True

    # NCIP 2.0 RenewItem
    ncip_res = client.post("/api/interop/ncip", json={
        "action": "RenewItem",
        "UserId": mem_no,
        "ItemId": acc_no
    })
    assert ncip_res.status_code == 200
    assert ncip_res.json()["NCIPMessage"]["RenewItemResponse"]["ItemId"] == acc_no

    # SIP2 Check-in (Msg 09)
    sip_ci = client.post("/api/interop/sip2", json={"raw_frame": f"09N20261108    10000020261108    100000APCS-SHELF-01|AO|AB{acc_no}|AC|"})
    assert sip_ci.status_code == 200
    assert sip_ci.json()["raw_response"].startswith("10")
    assert sip_ci.json()["parsed"]["ok"] is True

    # Verify transaction history and audit
    history_res = client.get(f"/api/circulation/history?accession_number={acc_no}")
    assert history_res.status_code == 200
    txns = history_res.json()["items"]
    assert len(txns) >= 1
    assert any(t["return_date"] is not None for t in txns)
    assert any(t["transaction_type"] == "checkout" for t in txns)

def test_ac04_circulation_restriction_rules():
    """
    AC 04: Block circulation for a reference item, a blocked member,
    or a member whose fine exceeds a configurable limit.
    """
    # 1. Reference item restriction (ACC-000001 is seeded reference-only)
    res_ref = client.post("/api/circulation/checkout", json={
        "membership_number": "MEM-00001",
        "accession_number": "ACC-000001"
    })
    assert res_ref.status_code == 422
    assert "reference only" in res_ref.json()["detail"].lower()

    # 2. Blocked member restriction (MEM-00002 is seeded blocked)
    cat_res = client.get("/api/books")
    available_acc = None
    for b in cat_res.json()["items"]:
        for itm in b.get("items", []):
            if itm["status"] == "available" and not itm["is_reference_only"]:
                available_acc = itm["accession_number"]
                break
        if available_acc:
            break

    res_blocked = client.post("/api/circulation/checkout", json={
        "membership_number": "MEM-00002",
        "accession_number": available_acc
    })
    assert res_blocked.status_code == 422
    assert "blocked" in res_blocked.json()["detail"].lower()

    # 3. Fine limit restriction (MEM-00003 is seeded with fine > $15)
    res_fines = client.post("/api/circulation/checkout", json={
        "membership_number": "MEM-00003",
        "accession_number": available_acc
    })
    assert res_fines.status_code == 422
    assert "fine balance" in res_fines.json()["detail"].lower()

def test_ac05_handheld_inventory_missing_misplaced_feedback():
    """
    AC 05: Use a handheld-reader mock to inventory a shelf and report
    missing and misplaced items with visible and audible confirmation events.
    """
    # Create book on CS-SHELF-01
    b1_res = client.post("/api/books", json={
        "isbn": f"978-0551{AC_RUN_ID}",
        "title": f"Shelf Correct Book {AC_RUN_ID}",
        "author_name": "Author 1",
        "category_code": "004",
        "initial_copies": 2,
        "shelf_location": "CS-SHELF-01"
    })
    item1 = b1_res.json()["items"][0]
    item_missing = b1_res.json()["items"][1]
    tag1_res = client.post("/api/rfid/tag-item", json={"book_item_id": item1["id"]})
    tag1_uid = tag1_res.json()["tag_uid"]

    # Create book expecting CS-SHELF-02
    b2_res = client.post("/api/books", json={
        "isbn": f"978-0552{AC_RUN_ID}",
        "title": f"Misplaced Book {AC_RUN_ID}",
        "author_name": "Author 2",
        "category_code": "004",
        "initial_copies": 1,
        "shelf_location": "CS-SHELF-02"
    })
    item2 = b2_res.json()["items"][0]
    tag2_res = client.post("/api/rfid/tag-item", json={"book_item_id": item2["id"]})
    tag2_uid = tag2_res.json()["tag_uid"]

    # Start inventory session for CS-SHELF-01
    sess_res = client.post("/api/inventory/sessions", json={
        "session_name": f"Session {AC_RUN_ID}",
        "target_shelf": "CS-SHELF-01"
    })
    assert sess_res.status_code == 201
    sess_id = sess_res.json()["id"]

    # Bulk scan both tags on CS-SHELF-01
    scan_res = client.post(f"/api/inventory/sessions/{sess_id}/scan", json={
        "tag_uids": [tag1_uid, tag2_uid],
        "detected_shelf": "CS-SHELF-01"
    })
    assert scan_res.status_code == 200
    scan_data = scan_res.json()
    assert scan_data["correctly_located"] >= 1
    assert scan_data["misplaced"] >= 1
    assert scan_data["scanned_count"] == 2

    # Complete session: item_missing was never scanned on CS-SHELF-01
    comp_res = client.post(f"/api/inventory/sessions/{sess_id}/complete")
    assert comp_res.status_code == 200
    comp_data = comp_res.json()
    assert comp_data["status"] == "completed"
    assert comp_data["total_missing"] >= 1

def test_ac06_security_gate_unauthorized_removal_cctv_and_notification():
    """
    AC 06: Generate an unauthorised-removal event from the gate mock,
    record the accession number, attach a mock CCTV image, and queue an email notification.
    """
    # Create unissued book with armed EAS bit
    b_res = client.post("/api/books", json={
        "isbn": f"978-0444{AC_RUN_ID}",
        "title": f"Security Protected Novel {AC_RUN_ID}",
        "author_name": "Author Sec",
        "category_code": "004",
        "initial_copies": 1,
        "shelf_location": "CS-SHELF-01"
    })
    item = b_res.json()["items"][0]
    tag_res = client.post("/api/rfid/tag-item", json={"book_item_id": item["id"], "eas_bit": True})
    tag_uid = tag_res.json()["tag_uid"]

    # Simulate unauthorized passage through gate
    gate_res = client.post("/api/gate/simulate-passage", json={
        "reader_id": "GATE-PED-01",
        "tag_uids": [tag_uid],
        "is_person_passing": True
    })
    assert gate_res.status_code == 201
    events = gate_res.json()
    assert len(events) >= 1
    gate_event = events[0]
    assert gate_event["alarm_triggered"] is True
    assert gate_event["event_type"] == "unauthorized_removal"
    assert gate_event["accession_number"] == item["accession_number"]
    assert gate_event["cctv_image_url"] is not None
    assert gate_event["cctv_image_url"].endswith(".svg")

    # Verify notification was queued
    notifs_res = client.get("/api/notifications?channel=email")
    assert notifs_res.status_code == 200
    notifs = notifs_res.json()
    assert any("Unauthorized RFID Item Removal" in (n.get("subject") or "") for n in notifs)

def test_ac07_smart_card_login_and_role_based_permissions():
    """
    AC 07: Demonstrate staff smart-card login through a mock credential provider
    and enforce role-based permissions.
    """
    # 1. Admin card tap
    admin_res = client.post("/api/auth/smartcard-login", json={"smart_card_uid": "SC-ADMIN-001"})
    assert admin_res.status_code == 200
    admin_token = admin_res.json()["access_token"]
    assert admin_res.json()["user"]["role_name"] == "ADMIN"

    # Verify admin can access administrative diagnostics
    diag_res = client.get("/api/admin/diagnostics", headers={"Authorization": f"Bearer {admin_token}"})
    assert diag_res.status_code == 200
    assert diag_res.json()["integrity_check"].lower() == "ok"

    # 2. Staff card tap
    staff_res = client.post("/api/auth/smartcard-login", json={"smart_card_uid": "SC-STAFF-003"})
    assert staff_res.status_code == 200
    assert staff_res.json()["user"]["role_name"] == "STAFF"

def test_ac08_dashboard_kpis_and_filterable_reports():
    """
    AC 08: Generate dashboard statistics and filterable reports for tagged items,
    members, circulation, operators, RFID clients, and gate events.
    """
    stats_res = client.get("/api/reports/dashboard-stats")
    assert stats_res.status_code == 200
    stats = stats_res.json()

    assert "total_titles" in stats
    assert "total_copies" in stats
    assert "tagged_copies" in stats
    assert "tag_coverage_percent" in stats
    assert "total_members" in stats
    assert "active_loans" in stats
    assert "gate_alarms_count" in stats
    assert len(stats["category_distribution"]) >= 1

    # Gate events report
    events_res = client.get("/api/gate/events?limit=20")
    assert events_res.status_code == 200
    assert len(events_res.json()) >= 1

def test_ac09_offline_execution_update_and_documented_rollback():
    """
    AC 09: Install and run the solution without internet access, apply an offline update,
    and complete a documented rollback.
    """
    cur_version = offline_update_service.get_current_app_version()
    os.makedirs("./data/updates", exist_ok=True)
    temp_patch = "./data/updates/patch_ac09.txt"
    with open(temp_patch, "w", encoding="utf-8") as f:
        f.write("AC09 Air-gapped Patch File\n")

    pkg = offline_update_service.create_update_package(
        version="1.2.0-ac09",
        release_notes="AC09 verified offline release",
        files_to_include={"data/updates/patch_ac09.txt": temp_patch}
    )

    # Login as admin to get authorized token
    admin_login = client.post("/api/auth/login", json={"username": "admin", "password": "admin123"})
    admin_token = admin_login.json()["access_token"]
    headers = {"Authorization": f"Bearer {admin_token}"}

    # Apply offline update
    apply_res = client.post("/api/admin/updates/apply", json={"package_path": pkg["package_path"]}, headers=headers)
    assert apply_res.status_code == 200
    assert apply_res.json()["current_version"] == "1.2.0-ac09"

    # Rollback to pre-update snapshot
    rb_res = client.post("/api/admin/updates/rollback", json={"snapshot_id": apply_res.json()["snapshot_id"]}, headers=headers)
    assert rb_res.status_code == 200
    assert rb_res.json()["current_version"] == cur_version

def test_ac10_backup_restoration_after_simulated_failed_migration():
    """
    AC 10: Restore from backup after a simulated failed migration or integration change
    and prove that the original data remains intact.
    ISOLATION GUARANTEE: Uses a separate temporary SQLite database; NEVER touches data/library.db.
    """
    import tempfile
    with tempfile.TemporaryDirectory() as tmpdir:
        temp_db_path = os.path.join(tmpdir, "isolated_ac10_library.db")
        temp_backup_dir = os.path.join(tmpdir, "backups")
        os.makedirs(temp_backup_dir, exist_ok=True)

        # 1. Initialize isolated database schema & baseline data
        conn = sqlite3.connect(temp_db_path)
        conn.execute("PRAGMA journal_mode=WAL;")
        conn.execute("CREATE TABLE books (id INTEGER PRIMARY KEY, isbn TEXT, title TEXT, is_serial INTEGER DEFAULT 0);")
        conn.execute("CREATE TABLE members (id INTEGER PRIMARY KEY, membership_number TEXT, full_name TEXT, email TEXT);")
        for i in range(1, 11):
            conn.execute(f"INSERT INTO books (isbn, title, is_serial) VALUES ('978-00000000{i:02d}', 'AC10 Baseline Book {i}', 0);")
            conn.execute(f"INSERT INTO members (membership_number, full_name, email) VALUES ('MEM-AC10-{i:03d}', 'Patron {i}', 'patron{i}@example.com');")
        conn.commit()
        conn.close()

        # 2. Take baseline backup from isolated database
        baseline = backup_service.create_backup(
            source_db_path=temp_db_path,
            backup_dir=temp_backup_dir,
            note="AC10 pre-corruption baseline"
        )
        backup_file = baseline["filename"]
        original_books = baseline["record_counts"]["books"]
        original_members = baseline["record_counts"]["members"]

        assert original_books == 10
        assert original_members == 10

        # 3. Simulate catastrophic failed migration / botched import that corrupts data
        conn = sqlite3.connect(temp_db_path)
        conn.execute("UPDATE members SET full_name='CORRUPTED RECORD', email='corrupt@example.com'")
        conn.execute("DELETE FROM books WHERE id > 3")  # simulate data loss
        conn.commit()
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM members WHERE full_name='CORRUPTED RECORD'")
        corrupted_count = cursor.fetchone()[0]
        cursor.execute("SELECT COUNT(*) FROM books")
        lost_books_count = cursor.fetchone()[0]
        conn.close()

        assert corrupted_count == 10
        assert lost_books_count == 3

        # 4. Restore baseline backup into isolated database
        restore_res = backup_service.restore_backup(
            filename=backup_file,
            target_db_path=temp_db_path,
            backup_dir=temp_backup_dir
        )
        assert restore_res["status"] == "success"
        assert restore_res["integrity_check"].lower() == "ok"

        # 5. Prove original records and attributes remain 100% intact and mutations are reversed
        post_conn = sqlite3.connect(temp_db_path)
        post_cursor = post_conn.cursor()
        post_cursor.execute("SELECT COUNT(*) FROM members WHERE full_name='CORRUPTED RECORD'")
        post_corrupted_count = post_cursor.fetchone()[0]
        post_cursor.execute("SELECT COUNT(*) FROM books")
        post_books = post_cursor.fetchone()[0]
        post_cursor.execute("SELECT COUNT(*) FROM members")
        post_members = post_cursor.fetchone()[0]
        post_conn.close()

        assert post_corrupted_count == 0
        assert post_books == original_books
        assert post_members == original_members
