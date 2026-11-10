import pytest
import time
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from main import app
from app.core.database import SessionLocal
from app.models.inventory import InventorySession, InventoryScan
from app.models.rfid import RfidTag
from app.models.catalog import BookItem
from app.models.gate import GateEvent
from app.services import inventory_service, gate_service, circulation_service

client = TestClient(app)

def test_inventory_historical_session_detail_preserves_stored_counts():
    """Verify that completed historical inventory sessions preserve stored metrics and missing count does not exceed expected."""
    db: Session = SessionLocal()
    try:
        # Check existing completed sessions in DB
        completed_sessions = db.query(InventorySession).filter(InventorySession.status == "completed").all()
        assert len(completed_sessions) > 0, "Expected at least one completed inventory session"

        for session in completed_sessions:
            detail = inventory_service.get_session_detail(db, session.id)
            assert detail is not None
            # Total missing must never exceed total expected
            assert detail.total_missing <= detail.total_expected, (
                f"Session {session.id} ({session.session_code}) has total_missing ({detail.total_missing}) "
                f"> total_expected ({detail.total_expected})"
            )
            # Must match the stored session.total_missing exactly
            assert detail.total_missing == session.total_missing
    finally:
        db.close()

def test_inventory_complete_session_caps_missing():
    """Verify that complete_session accurately sets total_missing <= total_expected."""
    db: Session = SessionLocal()
    try:
        # Create a test session
        test_session = inventory_service.create_session(
            db,
            session_name="QA Test Inventory Session",
            target_shelf="CS-SHELF-01",
            operator_user_id=1
        )
        assert test_session.id is not None
        assert test_session.total_expected > 0

        # Complete the session without scans
        completed = inventory_service.complete_session(db, test_session.id)
        assert completed.status == "completed"
        assert completed.total_missing <= completed.total_expected
        assert completed.total_missing == completed.total_expected - completed.total_scanned

        # Check detail endpoint
        detail = inventory_service.get_session_detail(db, completed.id)
        assert detail.total_missing <= detail.total_expected

        # Clean up test session
        sess = db.query(InventorySession).filter(InventorySession.id == test_session.id).first()
        if sess:
            db.delete(sess)
            db.commit()
    finally:
        db.close()

def test_gate_rapid_passage_cooldown_suppression():
    """Verify that accidental rapid repeated scans of the same tag at the gate return the cached event without duplicate alarms."""
    db: Session = SessionLocal()
    try:
        # Find an armed RFID tag
        tag = db.query(RfidTag).filter(RfidTag.status == "active", RfidTag.eas_bit == True).first()
        assert tag is not None, "Need an active armed tag for gate test"

        initial_event_count = db.query(GateEvent).count()

        # First passage
        event1 = gate_service.process_gate_tag(db, tag_uid=tag.tag_uid, reader_id="GATE-COOLDOWN-01")
        assert event1 is not None
        assert event1.alarm_triggered == True

        # Rapid second passage within cooldown (< 1.5s)
        event2 = gate_service.process_gate_tag(db, tag_uid=tag.tag_uid, reader_id="GATE-COOLDOWN-01")
        assert event2 is not None
        assert event2.id == event1.id, "Second passage should return the same cached event"

        # Database event count should only have increased by 1
        new_event_count = db.query(GateEvent).count()
        assert new_event_count == initial_event_count + 1

        # Clean up test event
        db.delete(event1)
        db.commit()
    finally:
        db.close()

def test_gate_authorized_passage_no_alarm():
    """Verify that disarmed EAS tags pass authorized without triggering alarms."""
    db: Session = SessionLocal()
    try:
        tag = db.query(RfidTag).filter(RfidTag.status == "active", RfidTag.eas_bit == False).first()
        if not tag:
            # Create a temporary disarmed tag
            tag = RfidTag(tag_uid="E004010099998888", status="active", eas_bit=False)
            db.add(tag)
            db.commit()

        event = gate_service.process_gate_tag(db, tag_uid=tag.tag_uid, reader_id="GATE-AUTH-01")
        assert event is not None
        assert event.alarm_triggered == False

        db.delete(event)
        db.commit()
    finally:
        db.close()

def test_reports_tagged_items_outerjoin_decommissioned():
    """Verify that tagged items report includes decommissioned tags (outerjoin BookItem)."""
    # Test query for decommissioned tags
    resp = client.get("/api/reports/tagged-items?status=decommissioned&limit=100")
    assert resp.status_code == 200
    data = resp.json()
    assert "records" in data
    assert data["total"] >= 37, f"Expected at least 37 decommissioned tags, got {data['total']}"
    for r in data["records"]:
        assert r["status"] == "decommissioned"

    # Test query for damaged tags
    resp_damaged = client.get("/api/reports/tagged-items?status=damaged&limit=100")
    assert resp_damaged.status_code == 200
    data_damaged = resp_damaged.json()
    assert "records" in data_damaged
    assert data_damaged["total"] >= 37

def test_reports_fines_ledger_reconciliation():
    """Verify that fines report triggers reconciliation and returns active patron fines."""
    resp = client.get("/api/reports/fines?limit=100")
    assert resp.status_code == 200
    data = resp.json()
    assert "records" in data
    assert data["total"] >= 2
    members = [r["membership_number"] for r in data["records"]]
    assert "MEM-00002" in members
    assert "MEM-00003" in members

def test_reports_csv_authenticated_export():
    """Verify that CSV export endpoints work and return text/csv with header row."""
    # Tagged items CSV
    resp = client.get("/api/reports/tagged-items?format=csv&limit=10")
    assert resp.status_code == 200
    assert "text/csv" in resp.headers.get("content-type", "")
    assert "Tag UID" in resp.text

    # Circulation CSV
    resp_circ = client.get("/api/reports/circulation?format=csv&limit=10")
    assert resp_circ.status_code == 200
    assert "text/csv" in resp_circ.headers.get("content-type", "")

    # Gate events CSV
    resp_gate = client.get("/api/reports/gate-events?format=csv&limit=10")
    assert resp_gate.status_code == 200
    assert "text/csv" in resp_gate.headers.get("content-type", "")

def test_data_migration_synthetic_in_memory_independence():
    """Verify that synthetic migration staging executes purely in-memory without CSV upload."""
    resp = client.post("/api/migration/generate-synthetic", json={"record_count": 20, "invalid_count": 2})
    assert resp.status_code == 201
    batch = resp.json()
    assert batch["total_records"] == 20
    assert batch["valid_records"] == 18
    assert batch["invalid_records"] == 2
    assert batch["status"] in ["validated", "validated_with_errors"]
    assert "synthetic_catalog" in batch["filename"]
