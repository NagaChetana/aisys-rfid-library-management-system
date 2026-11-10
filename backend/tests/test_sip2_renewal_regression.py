import os
import tempfile
from datetime import datetime, timedelta, timezone
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session

from main import app
from app.core.database import Base, get_db
from app.models.user import User, Role
from app.models.member import Member
from app.models.catalog import Book, BookItem
from app.models.rfid import RfidTag
from app.models.circulation import CirculationTransaction
from app.models.audit import AuditLog
from app.services import circulation_service
from app.interop.sip2_adapter import SIP2Adapter

@pytest.fixture(scope="module")
def isolated_sip2_test_env():
    """
    Creates an isolated temporary SQLite database for SIP2 renewal regression testing.
    Guarantees that production data (including live loan ACC-000002) is untouched.
    """
    temp_db_fd, temp_db_path = tempfile.mkstemp(suffix=".db")
    os.close(temp_db_fd)

    test_engine = create_engine(
        f"sqlite:///{temp_db_path}",
        connect_args={"check_same_thread": False}
    )
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

    # Create tables
    Base.metadata.create_all(bind=test_engine)

    # Seed initial test data
    db = TestingSessionLocal()
    try:
        # 1. Admin Role & User
        admin_role = Role(name="ADMIN", description="Administrator")
        db.add(admin_role)
        db.commit()

        admin_user = User(
            username="admin",
            email="admin@test.local",
            password_hash="hash",
            full_name="Administrator",
            role_id=admin_role.id,
            is_active=True
        )
        db.add(admin_user)

        # 2. Members
        alice = Member(
            full_name="Alice Smith",
            membership_number="MEM-00001",
            smart_card_uid="SC-TEST-00001",
            email="alice@test.local",
            status="active",
            fine_balance=0.0
        )
        bob = Member(
            full_name="Bob Jones",
            membership_number="MEM-00002",
            smart_card_uid="SC-TEST-00002",
            email="bob@test.local",
            status="active",
            fine_balance=0.0
        )
        db.add_all([alice, bob])

        # 3. Author & Category
        from app.models.catalog import Author, Category
        author = Author(name="Abraham Silberschatz")
        category = Category(code="005", name="Computer Science")
        db.add_all([author, category])
        db.commit()

        # 4. Book & Item
        book = Book(
            title="Database System Concepts",
            author_id=author.id,
            category_id=category.id,
            isbn="9780078022159",
            publisher="McGraw-Hill",
            publish_year=2020
        )
        db.add(book)
        db.commit()

        item = BookItem(
            book_id=book.id,
            accession_number="ACC-TEST-SIP2",
            barcode="BC-TEST-SIP2",
            shelf_location="CS-SHELF-01",
            status="available"
        )
        db.add(item)
        db.commit()

        tag = RfidTag(
            tag_uid="E2801160TEST001",
            book_item_id=item.id,
            item_type="book_item",
            eas_bit=True,
            status="active"
        )
        db.add(tag)
        db.commit()

    finally:
        db.close()

    def override_get_db():
        session = TestingSessionLocal()
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[get_db] = override_get_db
    client = TestClient(app)

    yield {
        "client": client,
        "SessionLocal": TestingSessionLocal,
        "engine": test_engine,
        "db_path": temp_db_path
    }

    # Teardown
    app.dependency_overrides.pop(get_db, None)
    test_engine.dispose()
    if os.path.exists(temp_db_path):
        os.remove(temp_db_path)

def test_sip2_renewal_date_accuracy_and_consistency(isolated_sip2_test_env):
    """
    Regression Test:
    1. Check out ACC-TEST-SIP2 to MEM-00001.
    2. Attempt SIP2 renewal with mismatching patron ID -> Must fail with Patron Mismatch.
    3. Send valid SIP2 Message 29 renewal -> Must succeed.
    4. Assert SIP2 AH field matches persisted transaction due date.
    5. Assert parsed payload matches persisted transaction due date and renewal count.
    6. Assert Due Date Enquiry endpoint returns identical due date and renewal count.
    7. Assert Circulation History endpoint returns identical due date and renewal count.
    8. Execute second renewal -> due date advances by 14 days, renewal_count becomes 2.
    9. Assert Due Date Enquiry and History match second renewal.
    10. Attempt third renewal -> Blocked by maximum renewal limit (2).
    """
    client = isolated_sip2_test_env["client"]
    SessionLocal = isolated_sip2_test_env["SessionLocal"]

    db: Session = SessionLocal()
    try:
        book_item = db.query(BookItem).filter(BookItem.accession_number == "ACC-TEST-SIP2").first()
        alice = db.query(Member).filter(Member.membership_number == "MEM-00001").first()

        # Step 1: Initial checkout via circulation_service
        tx = circulation_service.checkout_book(
            db,
            book_item=book_item,
            member=alice,
            protocol="SIP2",
            notes="Initial checkout for SIP2 test"
        )
        initial_due_date = tx.due_date
        assert tx.renewal_count == 0
        assert book_item.status == "checked_out"
    finally:
        db.close()

    # Step 2: Attempt renewal with wrong patron (MEM-00002 Bob)
    mismatch_resp = client.post("/api/interop/sip2", json={
        "raw_frame": "2920261110    120000AOUNIVERSITY-LIB|AAMEM-00002|ABACC-TEST-SIP2|"
    })
    assert mismatch_resp.status_code == 200
    mismatch_data = mismatch_resp.json()
    assert mismatch_data["raw_response"].startswith("300NNN")
    assert mismatch_data["parsed"]["ok"] is False
    assert "Patron" in mismatch_data["parsed"]["reason"]

    # Step 3: Perform valid SIP2 renewal #1
    renew1_resp = client.post("/api/interop/sip2", json={
        "raw_frame": "2920261110    120000AOUNIVERSITY-LIB|AAMEM-00001|ABACC-TEST-SIP2|"
    })
    assert renew1_resp.status_code == 200
    renew1_data = renew1_resp.json()
    assert renew1_data["raw_response"].startswith("301YYY")
    assert renew1_data["parsed"]["ok"] is True
    assert renew1_data["parsed"]["accession"] == "ACC-TEST-SIP2"
    assert renew1_data["parsed"]["member"] == "MEM-00001"
    assert renew1_data["parsed"]["renewal_count"] == 1

    # Verify persisted transaction in DB
    db = SessionLocal()
    try:
        persisted_tx = db.query(CirculationTransaction).filter(
            CirculationTransaction.book_item_id == book_item.id,
            CirculationTransaction.return_date.is_(None)
        ).first()

        assert persisted_tx is not None
        assert persisted_tx.renewal_count == 1
        persisted_due = persisted_tx.due_date if persisted_tx.due_date.tzinfo else persisted_tx.due_date.replace(tzinfo=timezone.utc)
        expected_renew1_due = initial_due_date + timedelta(days=14)
        assert persisted_due == expected_renew1_due

        # Assert SIP2 AH field matches persisted transaction
        ah_date_str = persisted_due.strftime("%Y%m%d    %H%M%S")
        assert f"|AH{ah_date_str}|" in renew1_data["raw_response"]
        assert renew1_data["parsed"]["new_due_date"] == ah_date_str
        assert renew1_data["parsed"]["due_date"] == persisted_due.isoformat()
        assert renew1_data["parsed"]["due_date_formatted"] == persisted_due.strftime("%d/%m/%Y")

        # Step 4: Verify Due Date Enquiry endpoint
        enquiry_resp = client.get("/api/circulation/due-date-enquiry?accession_number=ACC-TEST-SIP2")
        assert enquiry_resp.status_code == 200
        enquiry_data = enquiry_resp.json()
        assert enquiry_data["accession_number"] == "ACC-TEST-SIP2"
        assert enquiry_data["membership_number"] == "MEM-00001"
        assert enquiry_data["renewal_count"] == 1
        # Due dates must match exactly
        assert datetime.fromisoformat(enquiry_data["due_date"]).replace(tzinfo=timezone.utc) == persisted_due

        # Step 5: Verify Circulation History endpoint
        history_resp = client.get("/api/circulation/history?q=ACC-TEST-SIP2")
        assert history_resp.status_code == 200
        history_items = history_resp.json().get("items", [])
        matching_tx = next((t for t in history_items if t["accession_number"] == "ACC-TEST-SIP2"), None)
        assert matching_tx is not None
        assert matching_tx["renewal_count"] == 1
        assert datetime.fromisoformat(matching_tx["due_date"]).replace(tzinfo=timezone.utc) == persisted_due

        # Step 6: Perform valid SIP2 renewal #2
        renew2_resp = client.post("/api/interop/sip2", json={
            "raw_frame": "2920261110    120000AOUNIVERSITY-LIB|AAMEM-00001|ABACC-TEST-SIP2|"
        })
        assert renew2_resp.status_code == 200
        renew2_data = renew2_resp.json()
        assert renew2_data["raw_response"].startswith("301YYY")
        assert renew2_data["parsed"]["ok"] is True
        assert renew2_data["parsed"]["renewal_count"] == 2

        db.refresh(persisted_tx)
        persisted_due2 = persisted_tx.due_date if persisted_tx.due_date.tzinfo else persisted_tx.due_date.replace(tzinfo=timezone.utc)
        expected_renew2_due = expected_renew1_due + timedelta(days=14)
        assert persisted_due2 == expected_renew2_due
        assert persisted_tx.renewal_count == 2

        # Step 7: Verify Due Date Enquiry matches renewal #2
        enquiry_resp2 = client.get("/api/circulation/due-date-enquiry?accession_number=ACC-TEST-SIP2")
        assert enquiry_resp2.status_code == 200
        enquiry_data2 = enquiry_resp2.json()
        assert enquiry_data2["renewal_count"] == 2
        assert datetime.fromisoformat(enquiry_data2["due_date"]).replace(tzinfo=timezone.utc) == expected_renew2_due

        # Step 8: Perform SIP2 renewal #3 -> Must be rejected by max renewal limit (2)
        renew3_resp = client.post("/api/interop/sip2", json={
            "raw_frame": "2920261110    120000AOUNIVERSITY-LIB|AAMEM-00001|ABACC-TEST-SIP2|"
        })
        assert renew3_resp.status_code == 200
        renew3_data = renew3_resp.json()
        assert renew3_data["raw_response"].startswith("300NNN")
        assert renew3_data["parsed"]["ok"] is False
        assert "Maximum renewal limit" in renew3_data["parsed"]["reason"]

        # Persisted due date should NOT have changed
        db.refresh(persisted_tx)
        persisted_due3 = persisted_tx.due_date if persisted_tx.due_date.tzinfo else persisted_tx.due_date.replace(tzinfo=timezone.utc)
        assert persisted_due3 == expected_renew2_due
        assert persisted_tx.renewal_count == 2

        # Step 9: Verify Audit Logs contain CIRCULATION_RENEWAL records
        renewal_logs = db.query(AuditLog).filter(
            AuditLog.action == "CIRCULATION_RENEWAL",
            AuditLog.resource_id == str(persisted_tx.id)
        ).order_by(AuditLog.id.asc()).all()
        assert len(renewal_logs) == 2
        import json
        log1_details = json.loads(renewal_logs[0].details)
        assert log1_details["renewal_count"] == 1
        assert log1_details["accession_number"] == "ACC-TEST-SIP2"
        log2_details = json.loads(renewal_logs[1].details)
        assert log2_details["renewal_count"] == 2
        assert log2_details["accession_number"] == "ACC-TEST-SIP2"

    finally:
        db.close()

def test_sip2_renewal_nonexistent_and_not_checked_out(isolated_sip2_test_env):
    """Verify SIP2 Message 29 error handling for non-existent and unborrowed items."""
    client = isolated_sip2_test_env["client"]
    SessionLocal = isolated_sip2_test_env["SessionLocal"]

    # Non-existent accession
    res1 = client.post("/api/interop/sip2", json={
        "raw_frame": "2920261110    120000AOUNIVERSITY-LIB|AAMEM-00001|ABNON-EXISTENT-ACC|"
    })
    assert res1.status_code == 200
    d1 = res1.json()
    assert d1["raw_response"].startswith("300NNN")
    assert d1["parsed"]["ok"] is False
    assert "Item Not Found" in d1["parsed"]["reason"]

    # Create available item not checked out
    db: Session = SessionLocal()
    try:
        from app.models.catalog import Book, BookItem
        book = db.query(Book).first()
        available_item = BookItem(
            book_id=book.id,
            accession_number="ACC-TEST-AVAILABLE",
            barcode="BC-TEST-AVAILABLE",
            shelf_location="CS-SHELF-02",
            status="available"
        )
        db.add(available_item)
        db.commit()
    finally:
        db.close()

    res2 = client.post("/api/interop/sip2", json={
        "raw_frame": "2920261110    120000AOUNIVERSITY-LIB|AAMEM-00001|ABACC-TEST-AVAILABLE|"
    })
    assert res2.status_code == 200
    d2 = res2.json()
    assert d2["raw_response"].startswith("300NNN")
    assert d2["parsed"]["ok"] is False
    assert "No active loan found" in d2["parsed"]["reason"]

