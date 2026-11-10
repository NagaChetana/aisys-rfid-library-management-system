import pytest
import io
import csv
from datetime import datetime, timezone, timedelta
from fastapi.testclient import TestClient
from main import app
from app.core.database import SessionLocal
from app.models.catalog import Book, BookItem
from app.models.setting import SystemSetting
from app.notifications.adapters import default_print_adapter

client = TestClient(app)

def test_acquisitions_supplier_and_purchase_order_flow():
    """Tests Supplier creation, PO lifecycle, and receipt into catalog (FR01)."""
    # 1. Create Supplier
    sup_payload = {
        "name": f"Academic Book Press {datetime.now(timezone.utc).timestamp()}",
        "contact_person": "Robert Vance",
        "email": "orders@academicpress.com",
        "phone": "+1-800-555-0199",
        "address": "400 Library Way, Boston, MA"
    }
    sup_res = client.post("/api/acquisitions/suppliers", json=sup_payload)
    assert sup_res.status_code == 201, sup_res.text
    supplier_data = sup_res.json()
    supplier_id = supplier_data["id"]
    assert supplier_data["name"] == sup_payload["name"]

    # 2. Create Purchase Order
    po_payload = {
        "supplier_id": supplier_id,
        "notes": "Urgent textbook acquisition batch",
        "items": [
            {
                "title": "Quantum Computing Fundamentals",
                "author": "Eleanor Rigby",
                "isbn": "978-0134494199",
                "quantity": 2,
                "unit_price": 75.50
            }
        ]
    }
    po_res = client.post("/api/acquisitions/orders", json=po_payload)
    assert po_res.status_code == 201, po_res.text
    po_data = po_res.json()
    assert po_data["status"] == "ordered"
    assert po_data["total_cost"] == 151.00
    assert len(po_data["items"]) == 1
    item_id = po_data["items"][0]["id"]

    # 3. Receive Purchase Order Items
    receive_payload = {
        "item_id": item_id,
        "quantity_to_receive": 2,
        "shelf_location": "SCI-SHELF-B",
        "create_catalog_records": True
    }
    rec_res = client.post(f"/api/acquisitions/orders/{po_data['id']}/receive", json=receive_payload)
    assert rec_res.status_code == 200, rec_res.text
    rec_data = rec_res.json()
    assert rec_data["po"]["status"] == "received"
    assert len(rec_data["created_accessions"]) == 2

    # Verify newly created copies exist in catalog
    for acc in rec_data["created_accessions"]:
        copy_res = client.get(f"/api/books/items/{acc}")
        assert copy_res.status_code == 200
        assert copy_res.json()["shelf_location"] == "SCI-SHELF-B"

def test_serials_subscription_and_issue_receiving():
    """Tests Periodical/Serial subscription tracking and issue check-in (FR01)."""
    sub_code = f"SUB-IEEE-{int(datetime.now(timezone.utc).timestamp())}"
    sub_payload = {
        "subscription_code": sub_code,
        "title": "IEEE Transactions on Neural Networks",
        "issn": "1045-9227",
        "frequency": "Monthly",
        "start_date": "2026-01-01",
        "end_date": "2026-12-31",
        "annual_cost": 850.00,
        "shelf_location": "PERIODICALS-BAY-1"
    }
    sub_res = client.post("/api/acquisitions/serials", json=sub_payload)
    assert sub_res.status_code == 201, sub_res.text
    sub_data = sub_res.json()
    sub_id = sub_data["id"]
    assert sub_data["subscription_code"] == sub_code

    # Receive an Issue
    issue_payload = {
        "volume": "37",
        "issue_number": "11",
        "publication_date": "2026-11-01",
        "status": "received"
    }
    iss_res = client.post(f"/api/acquisitions/serials/{sub_id}/issues", json=issue_payload)
    assert iss_res.status_code == 201, iss_res.text
    issue_data = iss_res.json()
    assert issue_data["volume"] == "37"
    assert issue_data["issue_number"] == "11"
    assert issue_data["status"] == "received"
    assert issue_data["accession_number"].startswith("ACC-")

def test_barcode_and_spine_label_generation():
    """Tests Code128 vector SVG barcode and printable spine-label rendering (FR01)."""
    # Locate an existing item
    books_res = client.get("/api/books?limit=1")
    assert books_res.status_code == 200
    first_book = books_res.json()["items"][0]
    assert len(first_book["items"]) > 0
    accession = first_book["items"][0]["accession_number"]

    # 1. Barcode SVG endpoint
    bc_res = client.get(f"/api/books/items/{accession}/barcode")
    assert bc_res.status_code == 200
    assert "image/svg+xml" in bc_res.headers["content-type"]
    assert "<svg" in bc_res.text
    assert accession in bc_res.text or first_book["items"][0]["barcode"] in bc_res.text

    # 2. Spine Label endpoint
    spine_res = client.get(f"/api/books/items/{accession}/spine-label")
    assert spine_res.status_code == 200
    spine_data = spine_res.json()
    assert spine_data["accession_number"] == accession
    assert "author_mark" in spine_data
    assert "classification" in spine_data
    assert "<svg" in spine_data["barcode_svg"]
    assert "AISYS INTELLIGENT LIBRARY" in spine_data["printable_html"]

def test_reader_client_activity_and_heartbeat():
    """Tests RFID reader device registry and client heartbeat ping (FR03)."""
    # 1. List readers
    res = client.get("/api/rfid/readers")
    assert res.status_code == 200
    readers = res.json()
    assert len(readers) >= 4
    reader_ids = [r["reader_id"] for r in readers]
    assert "STAFF-PAD-01" in reader_ids
    assert "GATE-EAST-01" in reader_ids

    # 2. Ping heartbeat
    hb_payload = {
        "reader_id": "STAFF-PAD-01",
        "status": "online",
        "ip_address": "192.168.1.101"
    }
    hb_res = client.post("/api/rfid/readers/heartbeat", json=hb_payload)
    assert hb_res.status_code == 200
    hb_data = hb_res.json()
    assert hb_data["reader_id"] == "STAFF-PAD-01"
    assert hb_data["status"] == "online"

def test_rfid_tag_health_monitoring():
    """Tests RFID tag fleet health, EAS integrity, and coverage percentage (FR05)."""
    res = client.get("/api/rfid/tags/health")
    assert res.status_code == 200
    data = res.json()
    assert "total_tags" in data
    assert "coverage_percentage" in data
    assert "eas_armed_count" in data
    assert "rfid_health_grade" in data
    assert data["total_tags"] >= 100

def test_mock_print_adapter_and_notification_retry():
    """Tests Provider-Neutral MockPrintAdapter slip layout and failure retry (FR09)."""
    # 1. Enqueue print job
    print_payload = {
        "channel": "print",
        "recipient": "CIRC-PRINTER-01",
        "subject": "Due Date Checkout Slip",
        "body": "Item: ACC-000001\nTitle: AI Modern Approach\nDue Date: 2026-11-22"
    }
    res = client.post("/api/notifications/send-test", json=print_payload)
    assert res.status_code == 201, res.text
    notif = res.json()
    assert notif["channel"] == "print"
    assert notif["status"] == "sent"

    # Check print adapter recorded slip
    jobs = default_print_adapter.get_print_jobs()
    assert len(jobs) >= 1
    assert "DUE DATE CHECKOUT SLIP" in jobs[-1]["slip_text"]

    # 2. Verify retry endpoint
    retry_res = client.post(f"/api/notifications/{notif['id']}/retry")
    assert retry_res.status_code == 200
    assert retry_res.json()["attempts"] >= 2

def test_system_settings_configuration_crud():
    """Tests dynamic retrieval and update of business configuration parameters (FR11)."""
    admin_login = client.post("/api/auth/login", json={"username": "admin", "password": "admin123"})
    admin_token = admin_login.json()["access_token"]
    headers = {"Authorization": f"Bearer {admin_token}"}

    # 1. Get settings
    res = client.get("/api/admin/settings", headers=headers)
    assert res.status_code == 200
    settings_list = res.json()
    assert len(settings_list) >= 4
    keys = [s["key"] for s in settings_list]
    assert "max_fine_limit" in keys

    # 2. Update fine limit setting
    update_payload = {"max_fine_limit": "25.0"}
    put_res = client.put("/api/admin/settings", json=update_payload, headers=headers)
    assert put_res.status_code == 200
    assert put_res.json()["updated"]["max_fine_limit"]["new"] == "25.0"

    # Verify updated value is returned in GET
    res2 = client.get("/api/admin/settings", headers=headers)
    updated_dict = {s["key"]: s["value"] for s in res2.json()}
    assert updated_dict["max_fine_limit"] == "25.0"

    # Revert back to baseline 15.0 to preserve baseline test environment
    client.put("/api/admin/settings", json={"max_fine_limit": "15.0"}, headers=headers)

def test_filterable_reports_and_csv_export():
    """Tests all filterable report endpoints and CSV file generation (FR08, AC08)."""
    # 1. Circulation Report
    circ_json = client.get("/api/reports/circulation?format=json")
    assert circ_json.status_code == 200
    assert "records" in circ_json.json()

    circ_csv = client.get("/api/reports/circulation?format=csv")
    assert circ_csv.status_code == 200
    assert "text/csv" in circ_csv.headers["content-type"]
    assert "Accession Number" in circ_csv.text

    # 2. Tagged Items Report
    tag_json = client.get("/api/reports/tagged-items?format=json")
    assert tag_json.status_code == 200

    tag_csv = client.get("/api/reports/tagged-items?format=csv")
    assert tag_csv.status_code == 200
    assert "Tag UID" in tag_csv.text

    # 3. Members Report
    mem_json = client.get("/api/reports/members?format=json")
    assert mem_json.status_code == 200

    mem_csv = client.get("/api/reports/members?format=csv")
    assert mem_csv.status_code == 200
    assert "Membership Number" in mem_csv.text

    # 4. Fines Report
    fines_csv = client.get("/api/reports/fines?format=csv")
    assert fines_csv.status_code == 200
    assert "Fine ID" in fines_csv.text

    # 5. Gate Events Report
    gate_csv = client.get("/api/reports/gate-events?format=csv")
    assert gate_csv.status_code == 200
    assert "Event ID" in gate_csv.text

    # 6. Operator Activity Report
    audit_csv = client.get("/api/reports/operator-activity?format=csv")
    assert audit_csv.status_code == 200
    assert "Log ID" in audit_csv.text
