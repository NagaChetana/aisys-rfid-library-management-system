import uuid
import pytest
from fastapi.testclient import TestClient
from main import app
from app.core.database import SessionLocal
from app.models.catalog import Book, BookItem
from app.models.member import Member

client = TestClient(app)
TEST_RUN_ID = uuid.uuid4().hex[:6]

def test_system_health():
    """Verify health and diagnostics endpoints (FR11, NFR07)."""
    response = client.get("/api/admin/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["database"]["status"] == "connected"
    assert data["database"]["journal_mode"] == "WAL"

    diag_response = client.get("/api/admin/diagnostics")
    assert diag_response.status_code == 200
    diag = diag_response.json()
    assert diag["counts"]["users"] >= 3
    assert diag["counts"]["books"] >= 5
    assert diag["counts"]["members"] >= 4
    assert diag["integrity_check"] == "ok"

def test_auth_password_login():
    """Verify password authentication with JWT token return."""
    # Valid login
    response = client.post("/api/auth/login", json={"username": "admin", "password": "admin123"})
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["user"]["username"] == "admin"
    assert data["user"]["role_name"] == "ADMIN"

    # Invalid password
    bad_resp = client.post("/api/auth/login", json={"username": "admin", "password": "wrongpassword"})
    assert bad_resp.status_code == 401

def test_auth_smartcard_login():
    """Verify staff smart card tap login (AC07)."""
    # Tap valid admin card
    response = client.post("/api/auth/smartcard-login", json={"smart_card_uid": "SC-ADMIN-001"})
    assert response.status_code == 200
    data = response.json()
    assert data["user"]["username"] == "admin"
    assert data["user"]["role_name"] == "ADMIN"

    # Tap librarian card
    lib_resp = client.post("/api/auth/smartcard-login", json={"smart_card_uid": "SC-LIB-002"})
    assert lib_resp.status_code == 200
    assert lib_resp.json()["user"]["role_name"] == "LIBRARIAN"

    # Tap unknown card
    bad_resp = client.post("/api/auth/smartcard-login", json={"smart_card_uid": "UNKNOWN-CARD-999"})
    assert bad_resp.status_code == 401

def test_book_catalog_list_and_search():
    """Verify catalog search, filtering and copy representations (FR01, FR02)."""
    # List all
    res = client.get("/api/books")
    assert res.status_code == 200
    data = res.json()
    assert data["total"] >= 5
    assert len(data["items"]) >= 5

    # Full text search by title
    search_res = client.get("/api/books?q=Artificial Intelligence&limit=100")
    assert search_res.status_code == 200
    search_data = search_res.json()
    assert search_data["total"] >= 1
    assert any("Artificial Intelligence" in item["title"] for item in search_data["items"])

    # Search by ISBN
    isbn_res = client.get("/api/books?q=978-0134494166")
    assert isbn_res.status_code == 200
    assert isbn_res.json()["total"] >= 1
    assert isbn_res.json()["items"][0]["title"] == "Clean Architecture: A Craftsman's Guide to Software Structure"

def test_book_creation_with_copies():
    """Verify cataloguing a book with distinct physical copies and unique accession numbers (FR01)."""
    test_isbn = f"978-0596{TEST_RUN_ID}"
    test_title = f"Head First Design Patterns {TEST_RUN_ID}"
    payload = {
        "isbn": test_isbn,
        "title": test_title,
        "subtitle": "A Brain-Friendly Guide",
        "author_name": "Eric Freeman & Elisabeth Robson",
        "category_code": "004",
        "publisher": "O'Reilly Media",
        "publish_year": 2004,
        "initial_copies": 3,
        "shelf_location": "CS-SHELF-01",
        "is_reference_only": False
    }
    res = client.post("/api/books", json=payload)
    assert res.status_code == 201
    data = res.json()
    assert data["isbn"] == test_isbn
    assert data["copies_count"] == 3
    assert len(data["items"]) == 3

    # Verify accession numbers and barcodes are distinct
    accessions = [item["accession_number"] for item in data["items"]]
    barcodes = [item["barcode"] for item in data["items"]]
    assert len(set(accessions)) == 3
    assert len(set(barcodes)) == 3

    # Verify lookup by accession number
    first_acc = accessions[0]
    acc_res = client.get(f"/api/books/items/{first_acc}")
    assert acc_res.status_code == 200
    assert acc_res.json()["accession_number"] == first_acc

def test_add_copy_to_existing_book():
    """Verify appending a new physical copy to an existing title (FR01)."""
    # Find book
    books_res = client.get(f"/api/books?q={TEST_RUN_ID}")
    assert books_res.status_code == 200
    book_id = books_res.json()["items"][0]["id"]
    initial_copies = books_res.json()["items"][0]["copies_count"]

    # Add copy
    copy_payload = {
        "shelf_location": "CS-SHELF-01",
        "status": "available",
        "is_reference_only": True,
        "price": 35.00
    }
    add_res = client.post(f"/api/books/{book_id}/items", json=copy_payload)
    assert add_res.status_code == 201
    assert add_res.json()["is_reference_only"] is True

    # Check updated book copy count
    updated_res = client.get(f"/api/books/{book_id}")
    assert updated_res.json()["copies_count"] == initial_copies + 1

def test_virtual_bookshelf():
    """Verify virtual bookshelf grouping (FR02)."""
    res = client.get("/api/books/virtual-shelf")
    assert res.status_code == 200
    items = res.json()
    assert len(items) >= 5
    assert "isbn" in items[0]
    assert "available_copies" in items[0]

def test_member_management():
    """Verify member creation, card binding, and block/unblock actions (FR04, FR11)."""
    member_payload = {
        "full_name": f"Evelyn Reed {TEST_RUN_ID}",
        "email": f"evelyn.{TEST_RUN_ID}@university.edu",
        "phone": "+1-555-0199",
        "membership_type": "researcher",
        "max_allowed_loans": 7
    }
    create_res = client.post("/api/members", json=member_payload)
    assert create_res.status_code == 201
    member = create_res.json()
    assert member["full_name"] == f"Evelyn Reed {TEST_RUN_ID}"
    assert member["status"] == "active"
    member_id = member["id"]

    # Assign smart card UID
    card_uid = f"CARD-EVELYN-{TEST_RUN_ID.upper()}"
    card_res = client.post(f"/api/members/{member_id}/assign-card", json={"smart_card_uid": card_uid})
    assert card_res.status_code == 200
    assert card_res.json()["smart_card_uid"] == card_uid

    # Block member
    block_res = client.post(f"/api/members/{member_id}/block?reason=Lost%20Item%20Investigation")
    assert block_res.status_code == 200
    assert block_res.json()["status"] == "blocked"

    # Unblock member
    unblock_res = client.post(f"/api/members/{member_id}/unblock")
    assert unblock_res.status_code == 200
    assert unblock_res.json()["status"] == "active"

def test_duplicate_rejections():
    """Verify database unique constraints prevent duplicates (NFR01)."""
    # Duplicate ISBN
    dup_book = {
        "isbn": "978-0134610993",  # already exists in seed
        "title": "Duplicate AI Book",
        "author_name": "Some Author",
        "category_code": "004"
    }
    dup_res = client.post("/api/books", json=dup_book)
    assert dup_res.status_code == 409

    # Duplicate smart card assignment
    members_res = client.get("/api/members")
    member_id = members_res.json()["items"][0]["id"]
    dup_card_res = client.post(f"/api/members/{member_id}/assign-card", json={"smart_card_uid": "CARD-ALICE-1001"})
    # Alice already has CARD-ALICE-1001, so assigning to another should fail with 400
    second_member_id = members_res.json()["items"][1]["id"]
    dup_assign = client.post(f"/api/members/{second_member_id}/assign-card", json={"smart_card_uid": "CARD-ALICE-1001"})
    assert dup_assign.status_code == 400

def test_dashboard_stats():
    """Verify aggregated dashboard statistics (FR08, AC08)."""
    res = client.get("/api/reports/dashboard-stats")
    assert res.status_code == 200
    data = res.json()
    assert data["total_titles"] >= 5
    assert data["total_copies"] >= 10
    assert data["available_copies"] >= 10
    assert data["total_members"] >= 4
    assert data["blocked_members"] >= 1
    assert len(data["category_distribution"]) > 0
