"""
test_member_validation_regression.py — Regression tests for Member Registration Validation

Verifies:
1. Name only — registration succeeds (email and phone are optional).
2. Name + valid email — succeeds.
3. Name + empty string email — succeeds (converts to None).
4. Name + invalid email — rejected with 422 and readable error message.
5. Name + valid Indian phone number (10-digit, +91) — succeeds.
6. Name + empty string phone — succeeds (converts to None).
7. Name + invalid phone number (letters, bad length, invalid prefix) — rejected with 422.
8. Name + invalid email + invalid phone — both errors returned in validation details.
9. Empty/blank name — rejected with 422.
10. Duplicate smart card UID / membership number prevention.
"""

import uuid
import pytest
from fastapi.testclient import TestClient
from main import app
from app.core.database import SessionLocal
from app.models.member import Member

client = TestClient(app)

TEST_RUN_ID = uuid.uuid4().hex[:6]

@pytest.fixture(scope="module")
def admin_headers():
    resp = client.post("/api/auth/login", json={"username": "admin", "password": "admin123"})
    assert resp.status_code == 200, f"Login failed: {resp.text}"
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(autouse=True)
def cleanup_test_members():
    """Ensure any members created during this test run are safely removed after."""
    yield
    db = SessionLocal()
    try:
        test_members = db.query(Member).filter(Member.full_name.contains(f"ValReg_{TEST_RUN_ID}")).all()
        for m in test_members:
            db.delete(m)
        db.commit()
    finally:
        db.close()


def test_member_registration_name_only_succeeds(admin_headers):
    """Case 1: Full name only — registration succeeds, email and phone remain None."""
    payload = {
        "full_name": f"ValReg_{TEST_RUN_ID} Name Only"
    }
    resp = client.post("/api/members", json=payload, headers=admin_headers)
    assert resp.status_code == 201, resp.text
    data = resp.json()
    assert data["full_name"] == f"ValReg_{TEST_RUN_ID} Name Only"
    assert data["email"] is None
    assert data["phone"] is None
    assert data["status"] == "active"


def test_member_registration_name_and_valid_email_succeeds(admin_headers):
    """Case 2: Name + valid email — succeeds."""
    payload = {
        "full_name": f"ValReg_{TEST_RUN_ID} With Email",
        "email": f"patron.{TEST_RUN_ID}@university.edu"
    }
    resp = client.post("/api/members", json=payload, headers=admin_headers)
    assert resp.status_code == 201, resp.text
    data = resp.json()
    assert data["email"] == f"patron.{TEST_RUN_ID}@university.edu"


def test_member_registration_empty_email_succeeds(admin_headers):
    """Email is optional: submitting empty string email succeeds and normalizes to None."""
    payload = {
        "full_name": f"ValReg_{TEST_RUN_ID} Empty Email",
        "email": ""
    }
    resp = client.post("/api/members", json=payload, headers=admin_headers)
    assert resp.status_code == 201, resp.text
    data = resp.json()
    assert data["email"] is None


def test_member_registration_invalid_email_rejected(admin_headers):
    """Case 3: Name + invalid email — rejected with 422 and readable error."""
    payload = {
        "full_name": f"ValReg_{TEST_RUN_ID} Bad Email",
        "email": "not-a-valid-email"
    }
    resp = client.post("/api/members", json=payload, headers=admin_headers)
    assert resp.status_code == 422
    data = resp.json()
    details = data["detail"]
    assert any("email" in str(d.get("loc", [])) for d in details)
    error_msg = next(d["msg"] for d in details if "email" in str(d.get("loc", [])))
    assert "email" in error_msg.lower()


def test_member_registration_name_and_valid_indian_phone_succeeds(admin_headers):
    """Case 4: Name + valid Indian phone numbers (plain 10-digit and with +91) — succeeds."""
    # Test 10-digit plain
    payload1 = {
        "full_name": f"ValReg_{TEST_RUN_ID} Indian Plain Phone",
        "phone": "9876543210"
    }
    resp1 = client.post("/api/members", json=payload1, headers=admin_headers)
    assert resp1.status_code == 201, resp1.text
    assert resp1.json()["phone"] == "9876543210"

    # Test +91 formatted
    payload2 = {
        "full_name": f"ValReg_{TEST_RUN_ID} Indian +91 Phone",
        "phone": "+91 98765 43210"
    }
    resp2 = client.post("/api/members", json=payload2, headers=admin_headers)
    assert resp2.status_code == 201, resp2.text
    assert "+91" in resp2.json()["phone"]


def test_member_registration_empty_phone_succeeds(admin_headers):
    """Phone is optional: submitting empty string phone succeeds and normalizes to None."""
    payload = {
        "full_name": f"ValReg_{TEST_RUN_ID} Empty Phone",
        "phone": ""
    }
    resp = client.post("/api/members", json=payload, headers=admin_headers)
    assert resp.status_code == 201, resp.text
    data = resp.json()
    assert data["phone"] is None


def test_member_registration_invalid_phone_rejected(admin_headers):
    """Case 5: Name + invalid phone number — rejected with readable error."""
    # Letters in phone
    resp_alpha = client.post("/api/members", json={
        "full_name": f"ValReg_{TEST_RUN_ID} Alpha Phone",
        "phone": "98765abcde"
    }, headers=admin_headers)
    assert resp_alpha.status_code == 422
    assert any("phone" in str(d.get("loc", [])) for d in resp_alpha.json()["detail"])

    # Too short
    resp_short = client.post("/api/members", json={
        "full_name": f"ValReg_{TEST_RUN_ID} Short Phone",
        "phone": "98765"
    }, headers=admin_headers)
    assert resp_short.status_code == 422
    assert any("phone" in str(d.get("loc", [])) for d in resp_short.json()["detail"])

    # Invalid Indian mobile prefix (starts with 1)
    resp_bad_prefix = client.post("/api/members", json={
        "full_name": f"ValReg_{TEST_RUN_ID} Bad Prefix",
        "phone": "1234567890"
    }, headers=admin_headers)
    assert resp_bad_prefix.status_code == 422
    assert any("phone" in str(d.get("loc", [])) for d in resp_bad_prefix.json()["detail"])


def test_member_registration_invalid_email_and_invalid_phone_both_reported(admin_headers):
    """Case 6: Name + invalid email + invalid phone — both errors are returned."""
    payload = {
        "full_name": f"ValReg_{TEST_RUN_ID} Bad Both",
        "email": "invalid-email-address",
        "phone": "letters-only"
    }
    resp = client.post("/api/members", json=payload, headers=admin_headers)
    assert resp.status_code == 422
    details = resp.json()["detail"]
    locs = [str(d.get("loc", [])) for d in details]
    has_email_err = any("email" in l for l in locs)
    has_phone_err = any("phone" in l for l in locs)
    assert has_email_err, "Expected error on email field"
    assert has_phone_err, "Expected error on phone field"


def test_member_registration_empty_name_rejected(admin_headers):
    """Case 7: Empty or whitespace-only name — rejected."""
    # Empty string
    resp1 = client.post("/api/members", json={"full_name": ""}, headers=admin_headers)
    assert resp1.status_code == 422

    # Whitespace only
    resp2 = client.post("/api/members", json={"full_name": "   "}, headers=admin_headers)
    assert resp2.status_code == 422


def test_member_registration_duplicate_submission_prevention(admin_headers):
    """Case 8: Re-submitting with the same card UID is rejected, preventing duplicates."""
    card_uid = f"CARD-REG-{TEST_RUN_ID.upper()}"
    payload = {
        "full_name": f"ValReg_{TEST_RUN_ID} First",
        "smart_card_uid": card_uid
    }
    resp1 = client.post("/api/members", json=payload, headers=admin_headers)
    assert resp1.status_code == 201

    # Second submission with same card UID should be rejected
    payload2 = {
        "full_name": f"ValReg_{TEST_RUN_ID} Duplicate",
        "smart_card_uid": card_uid
    }
    resp2 = client.post("/api/members", json=payload2, headers=admin_headers)
    assert resp2.status_code == 400
    assert "already assigned" in resp2.json()["detail"].lower()
