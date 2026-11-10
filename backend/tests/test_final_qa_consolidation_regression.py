import pytest
import time
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from main import app
from app.core.database import SessionLocal
from app.models.member import Member
from app.models.circulation import CirculationTransaction, Fine
from app.models.catalog import Book, BookItem, Category, Author
from app.models.rfid import RfidTag, RfidTagHistory
from app.services import circulation_service, tag_service
from app.rfid.reader_service import simulate_staff_pad_scan
from app.rfid.deduplication import deduplicator
from app.interop.ncip_adapter import NCIP2Adapter
from app.interop.sip2_adapter import SIP2Adapter

client = TestClient(app)

def test_fine_reconciliation_legacy_patrons():
    """Verify that unledgered member fine balances are properly reconciled into Fine ledger records."""
    db: Session = SessionLocal()
    try:
        # Trigger reconciliation
        circulation_service.reconcile_member_fine_balances(db)

        # Check Bob Jones (MEM-00002) and Charlie Brown (MEM-00003)
        bob = db.query(Member).filter(Member.membership_number == "MEM-00002").first()
        charlie = db.query(Member).filter(Member.membership_number == "MEM-00003").first()

        assert bob is not None
        assert bob.fine_balance == 25.0
        bob_fines = db.query(Fine).filter(Fine.member_id == bob.id, Fine.status == "unpaid").all()
        assert len(bob_fines) >= 1
        assert sum(f.amount - f.paid_amount for f in bob_fines) == 25.0

        assert charlie is not None
        assert charlie.fine_balance == 18.5
        charlie_fines = db.query(Fine).filter(Fine.member_id == charlie.id, Fine.status == "unpaid").all()
        assert len(charlie_fines) >= 1
        assert sum(f.amount - f.paid_amount for f in charlie_fines) == 18.5

        # Check that GET /api/circulation/fines returns these fines
        resp = client.get("/api/circulation/fines")
        assert resp.status_code == 200
        fines_data = resp.json()
        assert len(fines_data) >= 2
        members_with_fines = [f["membership_number"] for f in fines_data]
        assert "MEM-00002" in members_with_fines
        assert "MEM-00003" in members_with_fines
    finally:
        db.close()

def test_loan_history_search_and_filtering():
    """Verify search by accession, title, borrower and filtering by status and protocol."""
    # 1. Search without query
    resp = client.get("/api/circulation/history?limit=10")
    assert resp.status_code == 200
    data = resp.json()
    assert "items" in data
    assert "total" in data

    # 2. Search by member name
    resp_search = client.get("/api/circulation/history?q=Alice&limit=10")
    assert resp_search.status_code == 200
    search_data = resp_search.json()
    for item in search_data["items"]:
        match = (
            "Alice" in item["member_name"] or
            "Alice" in item["book_title"] or
            "Alice" in item["accession_number"] or
            "Alice" in item["membership_number"]
        )
        assert match

    # 3. Filter by protocol
    resp_proto = client.get("/api/circulation/history?protocol=NCIP_2_0&limit=10")
    assert resp_proto.status_code == 200
    proto_data = resp_proto.json()
    for item in proto_data["items"]:
        assert item["protocol"] == "NCIP_2_0"

    # 4. Filter by status
    resp_status = client.get("/api/circulation/history?status=active&limit=10")
    assert resp_status.status_code == 200
    status_data = resp_status.json()
    for item in status_data["items"]:
        assert item["return_date"] is None

def test_ncip_and_sip2_consistency():
    """Verify common circulation service state between NCIP 2.0 and SIP2 adapters."""
    import uuid
    db: Session = SessionLocal()
    try:
        run_id = uuid.uuid4().hex[:6].upper()
        acc_num = f"ACC-INT-{run_id}"
        bar_code = f"BAR-INT-{run_id}"
        tag_epc = f"E2801160{run_id}0000000000"

        book = db.query(Book).first()
        assert book is not None

        item = BookItem(
            book_id=book.id,
            copy_number=999,
            accession_number=acc_num,
            barcode=bar_code,
            shelf_location="STACK-A-01",
            status="available",
            is_reference_only=False
        )
        db.add(item)
        db.commit()
        db.refresh(item)

        tag = RfidTag(
            tag_uid=tag_epc,
            book_item_id=item.id,
            item_type="book_item",
            status="active",
            eas_bit=True
        )
        db.add(tag)
        db.commit()

        # 1. Checkout via NCIP (using nested dict ItemId)
        ncip_checkout = NCIP2Adapter.process_message(db, {
            "NCIPMessage": {
                "CheckoutItem": {
                    "UserId": {"UserIdentifierValue": "MEM-00001"},
                    "ItemId": {"ItemIdentifierValue": acc_num}
                }
            }
        })
        assert "CheckoutItemResponse" in ncip_checkout["NCIPMessage"]
        resp_payload = ncip_checkout["NCIPMessage"]["CheckoutItemResponse"]
        assert "Problem" not in resp_payload
        assert resp_payload["Desensitize"] == "True"

        # Item should now be checked out and EAS bit disarmed
        db.refresh(item)
        assert item.status == "checked_out"

        # 2. Renew via SIP2 Msg 29
        sip_renew_frame = f"29YN20261110    120000AOUNIVERSITY-LIB|AAMEM-00001|AB{acc_num}|"
        sip_raw_resp, sip_parsed = SIP2Adapter.process_raw_message(db, sip_renew_frame)
        assert sip_parsed["ok"] is True
        assert sip_raw_resp.startswith("301")

        # 3. Checkin via SIP2 Msg 09
        sip_checkin_frame = f"09N20261110    120000AOUNIVERSITY-LIB|AB{acc_num}|"
        sip_ci_raw, sip_ci_parsed = SIP2Adapter.process_raw_message(db, sip_checkin_frame)
        assert sip_ci_parsed["ok"] is True
        assert sip_ci_parsed["resensitize"] is True

        db.refresh(item)
        assert item.status == "available"

        # Clean up test item
        txs = db.query(CirculationTransaction).filter(CirculationTransaction.book_item_id == item.id).all()
        for t in txs:
            db.delete(t)
        db.delete(tag)
        db.delete(item)
        db.commit()
    finally:
        db.close()

def test_rfid_scan_and_deduplication():
    """Verify multi-tag scanner suppresses duplicate reads within 3000ms."""
    db: Session = SessionLocal()
    try:
        deduplicator.clear()
        reader_id = "STAFF-PAD-01"
        tag_uids = ["E2801160TESTDEDUP001", "E2801160TESTDEDUP002"]

        # First scan
        res1 = simulate_staff_pad_scan(db, tag_uids, reader_id=reader_id, enforce_dedup=True)
        assert res1.suppressed_duplicates == 0

        # Immediate second scan (within 3000ms)
        res2 = simulate_staff_pad_scan(db, tag_uids, reader_id=reader_id, enforce_dedup=True)
        assert res2.suppressed_duplicates == 2
        assert len(res2.items) == 0
        assert len(res2.unknown_tags) == 0
    finally:
        db.close()

def test_sip2_parse_fields_with_attached_fixed_header():
    """Verify SIP2 variable field parsing when first tag follows fixed header without pipe."""
    raw = "09N20261110    120000AOUNIVERSITY-LIB|ABACC-000002|"
    fields = SIP2Adapter.parse_fields(raw)
    assert fields.get("AO") == "UNIVERSITY-LIB"
    assert fields.get("AB") == "ACC-000002"
