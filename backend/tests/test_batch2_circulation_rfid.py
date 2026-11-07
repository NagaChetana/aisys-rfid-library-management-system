import uuid
import pytest
from fastapi.testclient import TestClient
from main import app
from app.core.database import SessionLocal
from app.models.catalog import Book, BookItem
from app.models.member import Member
from app.models.rfid import RfidTag
from app.interop.sip2_adapter import SIP2Adapter

client = TestClient(app)
BATCH2_RUN_ID = uuid.uuid4().hex[:6]

def test_circulation_checkout_renew_checkin_flow():
    """Verify complete checkout -> renewal -> checkin circulation lifecycle (AC03, FR04)."""
    # 1. Create a fresh test member and copy to guarantee clean isolation
    member_res = client.post("/api/members", json={
        "full_name": f"Batch2 Patron {BATCH2_RUN_ID}",
        "email": f"b2patron_{BATCH2_RUN_ID}@university.edu",
        "phone": "+1-555-8822",
        "membership_type": "student",
        "max_allowed_loans": 5
    })
    assert member_res.status_code == 201
    member = member_res.json()
    member_num = member["membership_number"]

    book_res = client.post("/api/books", json={
        "isbn": f"978-777{BATCH2_RUN_ID}",
        "title": f"Batch2 Circulation Book {BATCH2_RUN_ID}",
        "author_name": "Circulation Specialist",
        "category_code": "004",
        "initial_copies": 1,
        "shelf_location": "CS-FLOW-01",
        "is_reference_only": False
    })
    assert book_res.status_code == 201
    book_data = book_res.json()
    accession = book_data["items"][0]["accession_number"]
    book_item_id = book_data["items"][0]["id"]

    # Tag the item first
    tag_res = client.post("/api/rfid/tag-item", json={"book_item_id": book_item_id})
    assert tag_res.status_code == 201
    tag_uid = tag_res.json()["tag_uid"]
    assert tag_res.json()["eas_bit"] is True  # Armed when available

    # 2. Checkout
    checkout_res = client.post("/api/circulation/checkout", json={
        "membership_number": member_num,
        "accession_number": accession,
        "due_days": 14,
        "protocol": "INTERNAL_UI"
    })
    assert checkout_res.status_code == 201
    checkout_data = checkout_res.json()
    assert checkout_data["transaction_type"] == "checkout"
    assert checkout_data["accession_number"] == accession
    assert checkout_data["membership_number"] == member_num
    assert checkout_data["eas_bit"] is False  # Disarmed upon issue

    # Verify book item status updated
    item_res = client.get(f"/api/books/items/{accession}")
    assert item_res.status_code == 200
    assert item_res.json()["status"] == "checked_out"

    # 3. Due Date Enquiry
    enquiry_res = client.get(f"/api/circulation/due-date-enquiry?accession_number={accession}")
    assert enquiry_res.status_code == 200
    enquiry_data = enquiry_res.json()
    assert enquiry_data["accession_number"] == accession
    assert enquiry_data["renewal_count"] == 0
    assert enquiry_data["is_overdue"] is False

    # 4. Renewal
    renew_res = client.post("/api/circulation/renew", json={
        "accession_number": accession,
        "additional_days": 7
    })
    assert renew_res.status_code == 200
    renew_data = renew_res.json()
    assert renew_data["renewal_count"] == 1

    # 5. Checkin
    checkin_res = client.post("/api/circulation/checkin", json={
        "accession_number": accession,
        "protocol": "INTERNAL_UI"
    })
    assert checkin_res.status_code == 200
    checkin_data = checkin_res.json()
    assert checkin_data["return_date"] is not None
    assert checkin_data["eas_bit"] is True  # Re-armed upon checkin

    # Verify item is available again
    item_check = client.get(f"/api/books/items/{accession}")
    assert item_check.json()["status"] == "available"

    # 6. Verify Transaction History
    hist_res = client.get(f"/api/circulation/history?book_item_id={book_item_id}")
    assert hist_res.status_code == 200
    assert hist_res.json()["total"] >= 1

def test_circulation_rule_reference_only_restriction():
    """Verify that reference-only copies cannot be checked out (AC04)."""
    # ACC-000001 is seeded as reference-only
    res = client.post("/api/circulation/checkout", json={
        "membership_number": "MEM-00001",
        "accession_number": "ACC-000001"
    })
    assert res.status_code == 422
    assert "Reference Only" in res.json()["detail"]

def test_circulation_rule_blocked_member_restriction():
    """Verify that blocked or suspended members cannot borrow books (AC04)."""
    # MEM-00002 is seeded as blocked
    # Find an available item
    cat_res = client.get("/api/books")
    available_acc = None
    for b in cat_res.json()["items"]:
        for itm in b.get("items", []):
            if itm["status"] == "available" and not itm["is_reference_only"]:
                available_acc = itm["accession_number"]
                break
        if available_acc:
            break

    res = client.post("/api/circulation/checkout", json={
        "membership_number": "MEM-00002",
        "accession_number": available_acc
    })
    assert res.status_code == 422
    assert "blocked" in res.json()["detail"].lower()

def test_circulation_rule_fine_limit_restriction():
    """Verify that members with fines exceeding the configured limit are blocked (AC04)."""
    # MEM-00003 is seeded with fine_balance = 18.50 (limit is 15.00)
    cat_res = client.get("/api/books")
    available_acc = None
    for b in cat_res.json()["items"]:
        for itm in b.get("items", []):
            if itm["status"] == "available" and not itm["is_reference_only"]:
                available_acc = itm["accession_number"]
                break
        if available_acc:
            break

    res = client.post("/api/circulation/checkout", json={
        "membership_number": "MEM-00003",
        "accession_number": available_acc
    })
    assert res.status_code == 422
    assert "fine balance" in res.json()["detail"].lower()

def test_circulation_rule_unavailable_copy_restriction():
    """Verify that already checked out copies cannot be checked out concurrently (AC04)."""
    # Create test book & member
    m_res = client.post("/api/members", json={
        "full_name": f"Patron Double {BATCH2_RUN_ID}",
        "email": f"double_{BATCH2_RUN_ID}@univ.edu",
        "phone": "+1-555-9988",
        "membership_type": "faculty"
    })
    member_num = m_res.json()["membership_number"]

    b_res = client.post("/api/books", json={
        "isbn": f"978-888{BATCH2_RUN_ID}",
        "title": f"Double Checkout Book {BATCH2_RUN_ID}",
        "author_name": "Test Author",
        "category_code": "004",
        "initial_copies": 1,
        "is_reference_only": False
    })
    acc = b_res.json()["items"][0]["accession_number"]

    # First checkout succeeds
    c1 = client.post("/api/circulation/checkout", json={"membership_number": member_num, "accession_number": acc})
    assert c1.status_code == 201

    # Second checkout of same copy must fail
    c2 = client.post("/api/circulation/checkout", json={"membership_number": member_num, "accession_number": acc})
    assert c2.status_code == 422
    assert "not available" in c2.json()["detail"].lower()

def test_rfid_tag_assignment_and_duplicate_prevention():
    """Verify RFID tag assignment and duplicate rejection (AC02, FR05)."""
    # Create book copy
    b_res = client.post("/api/books", json={
        "isbn": f"978-999{BATCH2_RUN_ID}",
        "title": f"Tag Test Book {BATCH2_RUN_ID}",
        "author_name": "Tag Master",
        "category_code": "004",
        "initial_copies": 2,
        "is_reference_only": False
    })
    item1_id = b_res.json()["items"][0]["id"]
    item2_id = b_res.json()["items"][1]["id"]

    # 1. Assign unique tag
    tag1_res = client.post("/api/rfid/tag-item", json={"book_item_id": item1_id})
    assert tag1_res.status_code == 201
    tag1_uid = tag1_res.json()["tag_uid"]

    # 2. Prevent duplicate tag assignment to second item
    dup_res = client.post("/api/rfid/tag-item", json={"book_item_id": item2_id, "tag_uid": tag1_uid})
    assert dup_res.status_code == 400
    assert "Duplicate Tag Error" in dup_res.json()["detail"]

    # 3. Prevent re-tagging already tagged item using standard tag endpoint
    re_res = client.post("/api/rfid/tag-item", json={"book_item_id": item1_id})
    assert re_res.status_code == 400
    assert "already tagged" in re_res.json()["detail"]

def test_rfid_retagging_and_audit_history():
    """Verify historical tag tracking and re-tagging workflow (AC02, FR05)."""
    # Create book copy
    b_res = client.post("/api/books", json={
        "isbn": f"978-111{BATCH2_RUN_ID}",
        "title": f"Retag Test Book {BATCH2_RUN_ID}",
        "author_name": "Tag Specialist",
        "category_code": "004",
        "initial_copies": 1,
        "is_reference_only": False
    })
    item_id = b_res.json()["items"][0]["id"]

    # Initial tag
    init_res = client.post("/api/rfid/tag-item", json={"book_item_id": item_id})
    assert init_res.status_code == 201
    old_tag_uid = init_res.json()["tag_uid"]

    # Retag with replacement reason
    new_tag_uid = f"E2801160{uuid.uuid4().hex[:16].upper()}"
    retag_res = client.post("/api/rfid/retag", json={
        "book_item_id": item_id,
        "new_tag_uid": new_tag_uid,
        "reason": "Damaged RFID antenna"
    })
    assert retag_res.status_code == 200
    assert retag_res.json()["tag_uid"] == new_tag_uid

    # Check history
    hist_res = client.get(f"/api/rfid/history?book_item_id={item_id}")
    assert hist_res.status_code == 200
    history = hist_res.json()
    assert len(history) >= 2

    # Old tag must be decommissioned with reason
    old_hist = next(h for h in history if h["tag_uid"] == old_tag_uid)
    assert old_hist["deassigned_at"] is not None
    assert old_hist["deassignment_reason"] == "Damaged RFID antenna"

    # New tag must be currently active
    new_hist = next(h for h in history if h["tag_uid"] == new_tag_uid)
    assert new_hist["deassigned_at"] is None

def test_rfid_invalid_tag_format():
    """Verify invalid RFID tag format validation (FR05)."""
    # Create book copy
    b_res = client.post("/api/books", json={
        "isbn": f"978-222{BATCH2_RUN_ID}",
        "title": f"Format Test Book {BATCH2_RUN_ID}",
        "author_name": "Format Tester",
        "category_code": "004",
        "initial_copies": 1
    })
    item_id = b_res.json()["items"][0]["id"]

    # Non-hex characters
    bad_res = client.post("/api/rfid/tag-item", json={
        "book_item_id": item_id,
        "tag_uid": "NOT-VALID-HEX-ZZZZZ!"
    })
    assert bad_res.status_code == 400
    assert "Invalid tag UID format" in bad_res.json()["detail"]

def test_rfid_staff_pad_simulation_and_deduplication():
    """Verify desktop staff pad scanning and sliding window deduplication (FR03, AC02)."""
    # Get seeded tags
    tags_res = client.get("/api/rfid/tags?limit=2")
    assert tags_res.status_code == 200
    items = tags_res.json()["items"]
    assert len(items) >= 2
    uids = [items[0]["tag_uid"], items[1]["tag_uid"]]

    # 1. First scan: both detected, suppressed duplicates = 0
    scan1 = client.post("/api/rfid/simulate/staff-scan", json={
        "reader_id": f"TEST-READER-{BATCH2_RUN_ID}",
        "tag_uids": uids,
        "enforce_dedup": True
    })
    assert scan1.status_code == 200
    data1 = scan1.json()
    assert data1["total_detected"] == 2
    assert data1["suppressed_duplicates"] == 0

    # 2. Immediate second scan of identical tags within 3000ms: suppressed
    scan2 = client.post("/api/rfid/simulate/staff-scan", json={
        "reader_id": f"TEST-READER-{BATCH2_RUN_ID}",
        "tag_uids": uids,
        "enforce_dedup": True
    })
    assert scan2.status_code == 200
    data2 = scan2.json()
    assert data2["suppressed_duplicates"] == 2
    assert data2["total_detected"] == 0

def test_rfid_smart_card_tap_simulation():
    """Verify smart card tap simulation for staff and members (AC07, FR03)."""
    # Tap Staff Card
    staff_tap = client.post("/api/rfid/simulate/smart-card-tap", json={"smart_card_uid": "SC-STAFF-003"})
    assert staff_tap.status_code == 200
    assert staff_tap.json()["entity_type"] == "staff"
    assert staff_tap.json()["username"] == "staff"

    # Tap Member Card
    member_tap = client.post("/api/rfid/simulate/smart-card-tap", json={"smart_card_uid": "CARD-ALICE-1001"})
    assert member_tap.status_code == 200
    assert member_tap.json()["entity_type"] == "member"
    assert member_tap.json()["full_name"] == "Alice Smith"

    # Tap Unknown Card
    unknown_tap = client.post("/api/rfid/simulate/smart-card-tap", json={"smart_card_uid": "UNREGISTERED-CARD-999"})
    assert unknown_tap.status_code == 200
    assert unknown_tap.json()["entity_type"] == "unknown"

def test_ncip2_adapter_mock_flows():
    """Verify mock NCIP 2.0 protocol adapter messages (FR03, AC03)."""
    # 1. LookupUser
    lookup_res = client.post("/api/interop/ncip", json={
        "action": "LookupUser",
        "UserId": "MEM-00001"
    })
    assert lookup_res.status_code == 200
    lookup_data = lookup_res.json()["NCIPMessage"]["LookupUserResponse"]
    assert lookup_data["UserId"] == "MEM-00001"
    assert lookup_data["UserOptionalFields"]["NameInformation"]["PersonalNameInformation"]["FullName"] == "Alice Smith"

    # 2. CheckoutItem via NCIP
    # Create item for clean test
    b_res = client.post("/api/books", json={
        "isbn": f"978-333{BATCH2_RUN_ID}",
        "title": f"NCIP Book {BATCH2_RUN_ID}",
        "author_name": "Protocol Expert",
        "category_code": "004",
        "initial_copies": 1,
        "is_reference_only": False
    })
    acc = b_res.json()["items"][0]["accession_number"]

    ncip_checkout = client.post("/api/interop/ncip", json={
        "action": "CheckoutItem",
        "UserId": "MEM-00001",
        "ItemId": acc
    })
    assert ncip_checkout.status_code == 200
    chk_resp = ncip_checkout.json()["NCIPMessage"]["CheckoutItemResponse"]
    assert chk_resp["ItemId"] == acc
    assert chk_resp["Desensitize"] == "True"

    # 3. RenewItem via NCIP
    ncip_renew = client.post("/api/interop/ncip", json={
        "action": "RenewItem",
        "ItemId": acc
    })
    assert ncip_renew.status_code == 200
    assert ncip_renew.json()["NCIPMessage"]["RenewItemResponse"]["RenewalCount"] == 1

    # 4. CheckinItem via NCIP
    ncip_checkin = client.post("/api/interop/ncip", json={
        "action": "CheckinItem",
        "ItemId": acc
    })
    assert ncip_checkin.status_code == 200
    assert ncip_checkin.json()["NCIPMessage"]["CheckinItemResponse"]["Resensitize"] == "True"

    # 5. Unsupported action returns Problem
    unknown_res = client.post("/api/interop/ncip", json={"action": "NonExistentService"})
    assert unknown_res.status_code == 200
    assert "Problem" in unknown_res.json()["NCIPMessage"]

def test_sip2_adapter_mock_flows():
    """Verify mock 3M SIP2 protocol adapter frame handling and checksum calculation (FR03, AC03)."""
    # 1. Message 63: Patron Status Request
    sip_patron = client.post("/api/interop/sip2", json={
        "raw_frame": "6300120261108    010000AOUNIVERSITY-LIB|AAMEM-00001|"
    })
    assert sip_patron.status_code == 200
    p_data = sip_patron.json()
    assert p_data["raw_response"].startswith("64")
    assert p_data["parsed"]["ok"] is True
    assert p_data["parsed"]["member"] == "Alice Smith"

    # 2. Message 11: Checkout Request
    # Create item
    b_res = client.post("/api/books", json={
        "isbn": f"978-444{BATCH2_RUN_ID}",
        "title": f"SIP2 Book {BATCH2_RUN_ID}",
        "author_name": "SIP Expert",
        "category_code": "004",
        "initial_copies": 1,
        "is_reference_only": False
    })
    acc = b_res.json()["items"][0]["accession_number"]

    sip_checkout = client.post("/api/interop/sip2", json={
        "raw_frame": f"11N0N20261108    010000AOUNIVERSITY-LIB|AAMEM-00001|AB{acc}|"
    })
    assert sip_checkout.status_code == 200
    c_data = sip_checkout.json()
    assert c_data["raw_response"].startswith("121")  # 121 -> ok = 1
    assert c_data["parsed"]["ok"] is True
    assert c_data["parsed"]["desensitize"] is True

    # 3. Message 29: Renew Request
    sip_renew = client.post("/api/interop/sip2", json={
        "raw_frame": f"2920261108    010000AOUNIVERSITY-LIB|AAMEM-00001|AB{acc}|"
    })
    assert sip_renew.status_code == 200
    r_data = sip_renew.json()
    assert r_data["raw_response"].startswith("301")  # 301 -> ok = 1
    assert r_data["parsed"]["ok"] is True

    # 4. Message 09: Checkin Request
    sip_checkin = client.post("/api/interop/sip2", json={
        "raw_frame": f"09N20261108    010000AOUNIVERSITY-LIB|AB{acc}|"
    })
    assert sip_checkin.status_code == 200
    ci_data = sip_checkin.json()
    assert ci_data["raw_response"].startswith("101")  # 101 -> ok = 1
    assert ci_data["parsed"]["ok"] is True
    assert ci_data["parsed"]["resensitize"] is True

    # 5. Verify Checksum validity
    raw = c_data["raw_response"]
    calc_chk = SIP2Adapter.calculate_checksum(raw)
    assert len(calc_chk) == 4
    assert c_data["checksum"] == calc_chk
