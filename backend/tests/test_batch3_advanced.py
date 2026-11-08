import uuid
import json
import pytest
from fastapi.testclient import TestClient
from main import app
from app.core.database import SessionLocal
from app.models.catalog import Book, BookItem
from app.models.member import Member
from app.models.rfid import RfidTag
from app.models.gate import GateEvent
from app.models.notification import NotificationQueue
from app.notifications.adapters import default_email_adapter
from app.services.event_broadcaster import broadcaster

client = TestClient(app)
BATCH3_RUN_ID = uuid.uuid4().hex[:6]

# ==============================================================================
# MODULE A: RFID INVENTORY & SHELF MANAGEMENT TESTS
# ==============================================================================

def test_inventory_session_lifecycle_and_bulk_scanning():
    """Verify inventory session creation, bulk scan, misplaced detection, duplicate suppression, and missing book resolution (AC05, FR06)."""
    # 1. Create 2 test book copies on shelf "SHELF-TEST-A" and 1 on "SHELF-TEST-B"
    b_res = client.post("/api/books", json={
        "isbn": f"978-555{BATCH3_RUN_ID}",
        "title": f"Inventory Book Alpha {BATCH3_RUN_ID}",
        "author_name": "Inventory Specialist",
        "category_code": "004",
        "initial_copies": 2,
        "shelf_location": "SHELF-TEST-A",
        "is_reference_only": False
    })
    assert b_res.status_code == 201
    item_a1 = b_res.json()["items"][0]
    item_a2 = b_res.json()["items"][1]

    # Tag item_a1
    tag_a1 = client.post("/api/rfid/tag-item", json={"book_item_id": item_a1["id"]}).json()["tag_uid"]

    # Create book on Shelf B
    b_res2 = client.post("/api/books", json={
        "isbn": f"978-666{BATCH3_RUN_ID}",
        "title": f"Inventory Book Beta {BATCH3_RUN_ID}",
        "author_name": "Inventory Specialist",
        "category_code": "004",
        "initial_copies": 1,
        "shelf_location": "SHELF-TEST-B",
        "is_reference_only": False
    })
    item_b1 = b_res2.json()["items"][0]
    tag_b1 = client.post("/api/rfid/tag-item", json={"book_item_id": item_b1["id"]}).json()["tag_uid"]

    # 2. Create Inventory Session for target shelf "SHELF-TEST-A"
    sess_res = client.post("/api/inventory/sessions", json={
        "session_name": f"Audit Session {BATCH3_RUN_ID}",
        "target_shelf": "SHELF-TEST-A"
    })
    assert sess_res.status_code == 201
    session_id = sess_res.json()["id"]
    assert sess_res.json()["target_shelf"] == "SHELF-TEST-A"
    assert sess_res.json()["total_expected"] >= 2

    # 3. Bulk Scan tags on shelf: tag_a1 (correct), tag_b1 (misplaced), and an unknown tag
    unknown_tag = f"E2801160UNKNOWN{BATCH3_RUN_ID.upper()}"
    scan_res = client.post(f"/api/inventory/sessions/{session_id}/scan", json={
        "tag_uids": [tag_a1, tag_b1, unknown_tag],
        "detected_shelf": "SHELF-TEST-A"
    })
    assert scan_res.status_code == 200
    scan_data = scan_res.json()
    assert scan_data["scanned_count"] == 3
    assert scan_data["correctly_located"] == 1
    assert scan_data["misplaced"] == 1
    assert scan_data["unknown_tags"] == 1
    assert scan_data["suppressed_duplicates"] == 0

    # 4. Duplicate scan suppression: scan tag_a1 again in the same session
    dup_scan = client.post(f"/api/inventory/sessions/{session_id}/scan", json={
        "tag_uids": [tag_a1],
        "detected_shelf": "SHELF-TEST-A"
    })
    assert dup_scan.status_code == 200
    assert dup_scan.json()["suppressed_duplicates"] == 1
    assert dup_scan.json()["scanned_count"] == 0

    # 5. Complete session: item_a2 was never scanned, so it must be marked missing!
    comp_res = client.post(f"/api/inventory/sessions/{session_id}/complete")
    assert comp_res.status_code == 200
    comp_data = comp_res.json()
    assert comp_data["status"] == "completed"
    assert comp_data["total_missing"] >= 1
    assert any(m["book_item_id"] == item_a2["id"] for m in comp_data["missing_items"])


# ==============================================================================
# MODULE B: RFID SECURITY GATE & CCTV TESTS
# ==============================================================================

def test_security_gate_unauthorized_alarm_and_cctv_trigger():
    """Verify security gate alarms for unissued items with armed EAS bit and mock CCTV attachment (AC06, FR07)."""
    # 1. Create an available item with EAS armed (True)
    b_res = client.post("/api/books", json={
        "isbn": f"978-771{BATCH3_RUN_ID}",
        "title": f"Gate Alarm Book {BATCH3_RUN_ID}",
        "author_name": "Gate Specialist",
        "category_code": "004",
        "initial_copies": 1,
        "is_reference_only": False
    })
    item_id = b_res.json()["items"][0]["id"]
    tag_uid = client.post("/api/rfid/tag-item", json={"book_item_id": item_id, "eas_bit": True}).json()["tag_uid"]

    # 2. Simulate passing through Gate Pedestal 01
    passage_res = client.post("/api/gate/simulate-passage", json={
        "reader_id": "GATE-PEDESTAL-01",
        "tag_uids": [tag_uid],
        "is_person_passing": True
    })
    assert passage_res.status_code == 201
    events = passage_res.json()
    assert len(events) == 1
    evt = events[0]
    assert evt["alarm_triggered"] is True
    assert evt["event_type"] == "unauthorized_removal"
    assert evt["eas_bit_state"] is True
    assert evt["cctv_image_url"] is not None

    # 3. Verify mock CCTV snapshot endpoint renders dynamic SVG
    cctv_res = client.get(evt["cctv_image_url"])
    assert cctv_res.status_code == 200
    assert "image/svg+xml" in cctv_res.headers["content-type"]
    assert "EAS VIOLATION" in cctv_res.text

    # 4. Verify automated email notification was queued for this incident
    notif_res = client.get("/api/notifications?channel=email")
    assert notif_res.status_code == 200
    notifs = notif_res.json()
    assert any("Unauthorized RFID Item Removal" in (n.get("subject") or "") for n in notifs)

def test_security_gate_authorized_passage():
    """Verify that legitimately checked-out books (EAS disarmed) pass through gate without alarm (AC06)."""
    # Create member & book
    m_res = client.post("/api/members", json={
        "full_name": f"Gate Patron {BATCH3_RUN_ID}",
        "email": f"gatepatron_{BATCH3_RUN_ID}@univ.edu",
        "phone": "+1-555-1122"
    })
    member_num = m_res.json()["membership_number"]

    b_res = client.post("/api/books", json={
        "isbn": f"978-772{BATCH3_RUN_ID}",
        "title": f"Authorized Gate Book {BATCH3_RUN_ID}",
        "author_name": "Gate Specialist",
        "category_code": "004",
        "initial_copies": 1
    })
    acc = b_res.json()["items"][0]["accession_number"]
    item_id = b_res.json()["items"][0]["id"]
    tag_uid = client.post("/api/rfid/tag-item", json={"book_item_id": item_id}).json()["tag_uid"]

    # Checkout book (disarms EAS bit)
    checkout_res = client.post("/api/circulation/checkout", json={
        "membership_number": member_num,
        "accession_number": acc
    })
    assert checkout_res.status_code == 201
    assert checkout_res.json()["eas_bit"] is False

    # Simulate passing gate with disarmed tag
    passage_res = client.post("/api/gate/simulate-passage", json={
        "reader_id": "GATE-PEDESTAL-01",
        "tag_uids": [tag_uid],
        "is_person_passing": True
    })
    assert passage_res.status_code == 201
    evt = passage_res.json()[0]
    assert evt["alarm_triggered"] is False
    assert evt["event_type"] == "authorized_passage"
    assert evt["cctv_image_url"] is None

def test_security_gate_footfall_and_stats():
    """Verify footfall tracking and gate aggregate statistics (FR07, FR08)."""
    # Record footfall
    ff_res = client.post("/api/gate/record-footfall?count=5")
    assert ff_res.status_code == 200
    assert ff_res.json()["recorded"] == 5

    # Check stats
    stats_res = client.get("/api/gate/stats")
    assert stats_res.status_code == 200
    data = stats_res.json()
    assert data["today_footfall"] >= 5
    assert data["total_events"] >= 1


# ==============================================================================
# MODULE C & D: SSE & NOTIFICATION ADAPTER TESTS
# ==============================================================================

def test_sse_event_broadcasting_and_latest_buffer():
    """Verify SSE event broadcaster and latest event sync buffer (Module C)."""
    # Trigger a broadcast
    broadcaster.broadcast("test_system_event", {"message": "Verification broadcast", "run_id": BATCH3_RUN_ID})

    # Query latest endpoint
    res = client.get("/api/events/latest")
    assert res.status_code == 200
    events = res.json()
    assert len(events) > 0
    assert any(e.get("event") == "test_system_event" for e in events)

def test_notification_delivery_and_failure_handling():
    """Verify notification queue dispatch, mock email delivery, and failure capture (FR09, Module D)."""
    # 1. Successful dispatch
    test_req = {
        "channel": "email",
        "recipient": f"librarian_{BATCH3_RUN_ID}@university.edu",
        "subject": "System Notice",
        "body": "Your circulation report is ready for download."
    }
    send_res = client.post("/api/notifications/send-test", json=test_req)
    assert send_res.status_code == 201
    data = send_res.json()
    assert data["status"] == "sent"
    assert data["attempts"] == 1
    assert data["sent_at"] is not None

    # 2. Simulate failure
    default_email_adapter.set_simulate_failure(True)
    try:
        fail_res = client.post("/api/notifications/send-test", json={
            "channel": "email",
            "recipient": "fail-target@university.edu",
            "subject": "Fail Test",
            "body": "Should simulate failure"
        })
        assert fail_res.status_code == 201
        fail_data = fail_res.json()
        assert fail_data["status"] == "failed"
        assert "Simulated SMTP host connection timeout" in (fail_data["error_message"] or "")
    finally:
        default_email_adapter.set_simulate_failure(False)


# ==============================================================================
# MODULE E: 20,000-RECORD DATA MIGRATION & SCOPED ROLLBACK TESTS
# ==============================================================================

def test_migration_csv_validation_and_duplicate_detection():
    """Verify CSV validation, format rejection, and duplicate detection (FR10, AC01)."""
    csv_sample = (
        "title,subtitle,author,isbn,category_code,publisher,publish_year,shelf_location,price,is_reference_only\n"
        "Valid Book 1,,Author One,978-1111111111,004,TechPress,2023,CS-01,30.0,0\n"
        ",,Author Two,978-2222222222,004,TechPress,2023,CS-01,30.0,0\n"  # missing title
        "Valid Book 3,,Author Three,BAD-ISBN-XYZ,004,TechPress,2023,CS-01,30.0,0\n"  # bad isbn
        "Duplicate Book,,Author Four,978-1111111111,004,TechPress,2023,CS-01,30.0,0\n"  # dup isbn within batch
    )

    files = {"file": ("test_catalog.csv", csv_sample, "text/csv")}
    upload_res = client.post("/api/migration/upload", files=files)
    assert upload_res.status_code == 201
    batch = upload_res.json()
    batch_id = batch["id"]

    # Verify reconciliation report
    rep_res = client.get(f"/api/migration/batches/{batch_id}/report")
    assert rep_res.status_code == 200
    report = rep_res.json()
    assert report["total_records"] == 4
    assert report["valid_records"] == 1
    assert report["invalid_records"] == 3
    assert len(report["sample_errors"]) >= 2

def test_migration_20k_synthetic_staging_execution_and_scoped_rollback():
    """
    High-volume stress & safety verification (FR10, NFR01, AC10):
    1. Stages a ~20,000 synthetic library record batch with validation.
    2. Executes atomic migration into catalog tables.
    3. Performs scoped rollback, ensuring only this batch is reversed and pre-existing records are 100% preserved.
    """
    # Record pre-existing books count to verify zero corruption
    pre_books_count = client.get("/api/books").json()["total"]
    assert pre_books_count >= 5

    # 1. Generate & stage 20,000 records
    gen_res = client.post("/api/migration/generate-synthetic", json={
        "record_count": 20000,
        "invalid_count": 100
    })
    assert gen_res.status_code == 201
    batch = gen_res.json()
    batch_id = batch["id"]
    assert batch["total_records"] == 20000
    assert batch["valid_records"] == 19900
    assert batch["invalid_records"] == 100

    # 2. Execute migration
    exec_res = client.post(f"/api/migration/batches/{batch_id}/execute")
    assert exec_res.status_code == 200
    migrated_batch = exec_res.json()
    assert migrated_batch["status"] == "migrated"
    assert migrated_batch["migrated_records"] == 19900

    # Verify books count increased
    post_books_count = client.get("/api/books").json()["total"]
    assert post_books_count == pre_books_count + 19900

    # 3. Scoped Rollback
    rollback_res = client.post(f"/api/migration/batches/{batch_id}/rollback")
    assert rollback_res.status_code == 200
    rb_data = rollback_res.json()
    assert rb_data["status"] == "rolled_back"
    assert rb_data["deleted_books_count"] == 19900

    # 4. CRITICAL INTEGRITY CHECK (NFR01): Pre-existing catalog records are completely preserved!
    final_books_count = client.get("/api/books").json()["total"]
    assert final_books_count == pre_books_count
