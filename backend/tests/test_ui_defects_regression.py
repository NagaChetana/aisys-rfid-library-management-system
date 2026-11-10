"""
test_ui_defects_regression.py — Regression tests for UI defect rectification:
CAT-01..05, ACQ-01..03, and MEM-01..06

Verifies:
1. CAT-03: Catalog search by title, author, ISBN, call number.
2. CAT-04: Catalog available copy calculation strictly excludes reference-only and non-available copies.
3. CAT-05: Book copies include accession_number, barcode, shelf_location, and status.
4. ACQ-01..03: Acquisitions endpoints for suppliers, purchase orders, and serials.
5. MEM-01: "All Statuses" endpoint includes both active and blocked members (Bob Jones appears in All and Blocked).
6. MEM-01: Filter consistency between active and blocked status filters.
7. MEM-04: Single member profile enquiry endpoint returns complete details for active and blocked patrons.
"""

import pytest
from fastapi.testclient import TestClient
from main import app
from app.core.database import SessionLocal
from app.models.catalog import Book, BookItem
from app.models.member import Member

client = TestClient(app)

# ─── PART A: CATALOG & COPIES (CAT-01..05) ──────────────────────────

def test_cat03_catalog_search_by_fields():
    """Verify CAT-03: Search by title, author, ISBN, and call number."""
    db = SessionLocal()
    sample_book = db.query(Book).first()
    assert sample_book is not None, "Need at least one book in DB"
    title_word = sample_book.title.split()[0]
    isbn = sample_book.isbn
    call_num = sample_book.call_number
    author_name = sample_book.author.name if sample_book.author else None
    db.close()

    # Search by Title keyword
    resp_title = client.get(f"/api/books?q={title_word}")
    assert resp_title.status_code == 200
    assert resp_title.json()["total"] >= 1

    # Search by full ISBN (exact/unique)
    resp_isbn = client.get(f"/api/books?q={isbn}")
    assert resp_isbn.status_code == 200
    assert resp_isbn.json()["total"] >= 1
    assert any(b["id"] == sample_book.id for b in resp_isbn.json()["items"])

    # Search by Call Number if present
    if call_num:
        resp_call = client.get(f"/api/books?q={call_num}")
        assert resp_call.status_code == 200
        assert resp_call.json()["total"] >= 1

    # Search by Author if present
    if author_name:
        author_word = author_name.split()[0]
        resp_author = client.get(f"/api/books?q={author_word}")
        assert resp_author.status_code == 200
        assert resp_author.json()["total"] >= 1

    # Search non-matching term returns empty items list without error
    resp_none = client.get("/api/books?q=NonExistentKeywordXYZ999")
    assert resp_none.status_code == 200
    assert resp_none.json()["total"] == 0
    assert len(resp_none.json()["items"]) == 0


def test_cat04_available_copies_excludes_reference_and_unavailable():
    """Verify CAT-04: Available copy count excludes reference-only and checked-out items."""
    resp = client.get("/api/books?limit=50")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] > 0

    db = SessionLocal()
    try:
        for book_dict in data["items"]:
            book_id = book_dict["id"]
            db_copies = db.query(BookItem).filter(BookItem.book_id == book_id).all()
            expected_avail = sum(
                1 for c in db_copies if c.status == "available" and not c.is_reference_only
            )
            assert book_dict["available_copies_count"] == expected_avail, (
                f"Mismatch for book {book_id}: expected {expected_avail}, "
                f"got {book_dict['available_copies_count']}"
            )
    finally:
        db.close()


def test_cat05_individual_copy_details():
    """Verify CAT-05: Book items include accession number, barcode, shelf, and status."""
    resp = client.get("/api/books?limit=10")
    assert resp.status_code == 200
    for book in resp.json()["items"]:
        for copy in book["items"]:
            assert "accession_number" in copy
            assert "barcode" in copy
            assert "shelf_location" in copy
            assert "status" in copy
            assert "is_reference_only" in copy
            assert len(copy["accession_number"]) > 0


# ─── PART B: ACQUISITIONS (ACQ-01..03) ──────────────────────────────

def test_acq_endpoints_data_integrity():
    """Verify ACQ-01..03: Supplier, PO, and Serial subscription data endpoints."""
    # Suppliers
    resp_supp = client.get("/api/acquisitions/suppliers")
    assert resp_supp.status_code == 200
    suppliers = resp_supp.json()
    assert isinstance(suppliers, list)

    # Purchase Orders
    resp_po = client.get("/api/acquisitions/orders")
    assert resp_po.status_code == 200
    orders = resp_po.json()
    assert isinstance(orders, list)

    # Serials
    resp_serials = client.get("/api/acquisitions/serials")
    assert resp_serials.status_code == 200
    serials = resp_serials.json()
    assert isinstance(serials, list)


# ─── PART C: MEMBERS & CARDS (MEM-01..06) ───────────────────────────

def test_mem01_all_statuses_includes_bob_jones_and_blocked():
    """Verify MEM-01: 'All Statuses' query includes both active and blocked patrons."""
    # Query with default / all status (no status filter)
    resp_all = client.get("/api/members?limit=250")
    assert resp_all.status_code == 200
    data_all = resp_all.json()
    items_all = data_all["items"]

    # Verify Bob Jones is in the list
    bob_in_all = any("Bob Jones" in m["full_name"] for m in items_all)
    assert bob_in_all, "Bob Jones must be present when querying All Statuses"

    # Verify both active and blocked statuses are present in the result set
    statuses_in_all = {m["status"] for m in items_all}
    assert "active" in statuses_in_all, "Active patrons must be present"
    assert "blocked" in statuses_in_all, "Blocked patrons must be present"

    # Query with status=blocked
    resp_blocked = client.get("/api/members?status=blocked")
    assert resp_blocked.status_code == 200
    data_blocked = resp_blocked.json()
    assert data_blocked["total"] >= 1
    assert all(m["status"] == "blocked" for m in data_blocked["items"])
    assert any("Bob Jones" in m["full_name"] for m in data_blocked["items"])

    # Query with status=active
    resp_active = client.get("/api/members?status=active&limit=250")
    assert resp_active.status_code == 200
    data_active = resp_active.json()
    assert all(m["status"] == "active" for m in data_active["items"])
    assert not any("Bob Jones" in m["full_name"] for m in data_active["items"])


def test_mem04_member_details_endpoint_and_fields():
    """Verify MEM-04: Single member lookup returns complete profile fields for active & blocked."""
    db = SessionLocal()
    # Find one active and one blocked member
    active_m = db.query(Member).filter(Member.status == "active").first()
    blocked_m = db.query(Member).filter(Member.status == "blocked").first()
    db.close()

    assert active_m is not None, "Need active member in DB"
    assert blocked_m is not None, "Need blocked member in DB"

    required_fields = [
        "id", "membership_number", "full_name", "email", "phone",
        "membership_type", "smart_card_uid", "status", "fine_balance",
        "active_loans_count", "max_allowed_loans", "created_at"
    ]

    # Verify Active Member Details
    resp_act = client.get(f"/api/members/{active_m.id}")
    assert resp_act.status_code == 200
    data_act = resp_act.json()
    for field in required_fields:
        assert field in data_act, f"Field {field} missing from member response"
    assert data_act["status"] == "active"

    # Verify Blocked Member Details
    resp_blk = client.get(f"/api/members/{blocked_m.id}")
    assert resp_blk.status_code == 200
    data_blk = resp_blk.json()
    for field in required_fields:
        assert field in data_blk, f"Field {field} missing from blocked member response"
    assert data_blk["status"] == "blocked"
    assert "Bob Jones" in data_blk["full_name"]
