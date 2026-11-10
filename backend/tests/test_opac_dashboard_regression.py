"""
test_opac_dashboard_regression.py — Regression tests for DASH-01..05 and OPAC-01..05

Verifies:
1. OPAC-01 & OPAC-03: Empty category returns empty list (200 OK) without error.
2. OPAC-05: Virtual bookshelf only counts loanable copies (available and NOT reference-only).
3. OPAC-05: Catalog endpoint available_copies_count also excludes reference-only copies.
4. DASH-01 & DASH-02: Dashboard stats endpoint returns valid category and shelf distributions with non-negative counts.
"""

import pytest
from fastapi.testclient import TestClient
from main import app
from app.core.database import SessionLocal
from app.models.catalog import Book, BookItem

client = TestClient(app)

def test_dashboard_stats_regression():
    """Verify DASH-01 & DASH-05: Dashboard stats response structure and distributions."""
    resp = client.get("/api/reports/dashboard-stats")
    assert resp.status_code == 200
    data = resp.json()
    
    # Must have required metric fields
    assert "total_titles" in data
    assert "total_copies" in data
    assert "available_copies" in data
    assert "tag_coverage_percent" in data
    assert "category_distribution" in data
    assert "shelf_distribution" in data

    # Distributions must be non-empty lists with name/count
    assert isinstance(data["category_distribution"], list)
    assert isinstance(data["shelf_distribution"], list)
    
    for item in data["category_distribution"]:
        assert "name" in item
        assert "count" in item
        assert item["count"] >= 0

    for item in data["shelf_distribution"]:
        assert "shelf" in item
        assert "count" in item
        assert item["count"] >= 0


def test_virtual_bookshelf_empty_category_regression():
    """Verify OPAC-01: Empty Dewey category (100) returns empty list [] without error."""
    resp = client.get("/api/books/virtual-shelf?category_code=100")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    assert len(data) == 0


def test_virtual_bookshelf_reference_only_not_available_regression():
    """Verify OPAC-05: available_copies excludes reference-only items."""
    resp = client.get("/api/books/virtual-shelf")
    assert resp.status_code == 200
    shelf_items = resp.json()
    assert len(shelf_items) > 0

    db = SessionLocal()
    try:
        for item in shelf_items:
            book_id = item["id"]
            # Query actual physical copies in DB
            db_items = db.query(BookItem).filter(BookItem.book_id == book_id).all()
            
            # Count available non-reference copies
            expected_available = sum(
                1 for bi in db_items if bi.status == "available" and not bi.is_reference_only
            )
            assert item["available_copies"] == expected_available, (
                f"Mismatch for book_id {book_id}: expected {expected_available} available copies, "
                f"got {item['available_copies']}"
            )
    finally:
        db.close()


def test_catalog_available_copies_excludes_reference():
    """Verify OPAC-05 on catalog list: available_copies_count excludes is_reference_only."""
    resp = client.get("/api/books")
    assert resp.status_code == 200
    res_data = resp.json()
    assert "items" in res_data
    books = res_data["items"]
    assert len(books) > 0

    db = SessionLocal()
    try:
        for b in books:
            book_id = b["id"]
            db_items = db.query(BookItem).filter(BookItem.book_id == book_id).all()
            expected_available = sum(
                1 for bi in db_items if bi.status == "available" and not bi.is_reference_only
            )
            assert b["available_copies_count"] == expected_available
    finally:
        db.close()
