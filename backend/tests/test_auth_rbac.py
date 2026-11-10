"""
test_auth_rbac.py — Authentication & Role-Based Access Control Tests

Tests that:
  1. Valid credentials → correct role in token (Part A, NFR02, AC07)
  2. Invalid credentials → 401
  3. Deactivated account → 403
  4. Smart card login → role from DB (not frontend)
  5. Unknown smart card → 401
  6. Admin can access /admin/users
  7. Staff token cannot POST /admin/users → 403
  8. Librarian token cannot PUT /admin/settings → 403
  9. GET /auth/me with valid token → 200, correct user
 10. GET /auth/me with no token → 401
 11. Admin can create a new user → 201
 12. Duplicate username rejected → 400
 13. Last active admin cannot be deactivated → 400
 14. Admin can list roles
 15. Toggle user status (activate/deactivate)
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from main import app
from app.core.database import get_db, SessionLocal
from app.models.user import User, Role
from app.core.security import get_password_hash

client = TestClient(app)


# ─── Fixtures ──────────────────────────────────────────────────────────────

@pytest.fixture(scope="module")
def db():
    session = SessionLocal()
    yield session
    session.close()


def _get_token(username: str, password: str) -> str:
    resp = client.post("/api/auth/login", json={"username": username, "password": password})
    assert resp.status_code == 200, f"Login failed for {username}: {resp.text}"
    return resp.json()["access_token"]


@pytest.fixture(scope="module")
def admin_token():
    return _get_token("admin", "admin123")


@pytest.fixture(scope="module")
def librarian_token():
    return _get_token("librarian", "lib123")


@pytest.fixture(scope="module")
def staff_token():
    return _get_token("staff", "staff123")


# ─── 1-3: Password login → correct role ───────────────────────────────────

def test_admin_password_login_returns_admin_role():
    resp = client.post("/api/auth/login", json={"username": "admin", "password": "admin123"})
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert data["user"]["role_name"] == "ADMIN"
    assert data["user"]["username"] == "admin"


def test_librarian_password_login_returns_librarian_role():
    resp = client.post("/api/auth/login", json={"username": "librarian", "password": "lib123"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["user"]["role_name"] == "LIBRARIAN"


def test_staff_password_login_returns_staff_role():
    resp = client.post("/api/auth/login", json={"username": "staff", "password": "staff123"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["user"]["role_name"] == "STAFF"


def test_invalid_credentials_rejected():
    resp = client.post("/api/auth/login", json={"username": "admin", "password": "wrongpassword"})
    assert resp.status_code == 401


def test_nonexistent_user_rejected():
    resp = client.post("/api/auth/login", json={"username": "ghost_user_xyz", "password": "anything"})
    assert resp.status_code == 401


# ─── 4-5: Smart card login ─────────────────────────────────────────────────

def test_smartcard_login_admin_returns_admin_role():
    resp = client.post("/api/auth/smartcard-login", json={"smart_card_uid": "SC-ADMIN-001"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["user"]["role_name"] == "ADMIN"


def test_smartcard_login_librarian_returns_librarian_role():
    resp = client.post("/api/auth/smartcard-login", json={"smart_card_uid": "SC-LIB-002"})
    assert resp.status_code == 200
    assert resp.json()["user"]["role_name"] == "LIBRARIAN"


def test_smartcard_login_unknown_uid_rejected():
    resp = client.post("/api/auth/smartcard-login", json={"smart_card_uid": "UNKNOWN-UID-9999"})
    assert resp.status_code == 401


# ─── 6-8: RBAC enforcement ────────────────────────────────────────────────

def test_admin_can_list_users(admin_token):
    resp = client.get("/api/admin/users", headers={"Authorization": f"Bearer {admin_token}"})
    assert resp.status_code == 200
    users = resp.json()
    assert isinstance(users, list)
    assert len(users) >= 3  # admin, librarian, staff seed accounts


def test_staff_cannot_create_user(staff_token):
    resp = client.post(
        "/api/admin/users",
        json={"username": "newusr", "email": "newusr@lib.local", "password": "pass123",
              "role_id": 3, "full_name": "New User"},
        headers={"Authorization": f"Bearer {staff_token}"}
    )
    assert resp.status_code == 403


def test_librarian_cannot_update_settings(librarian_token):
    resp = client.put(
        "/api/admin/settings",
        json={"max_fine_limit": "99.0"},
        headers={"Authorization": f"Bearer {librarian_token}"}
    )
    assert resp.status_code == 403


# ─── 9-10: /auth/me ───────────────────────────────────────────────────────

def test_get_current_user_valid_token(admin_token):
    resp = client.get("/api/auth/me", headers={"Authorization": f"Bearer {admin_token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["username"] == "admin"
    assert data["role_name"] == "ADMIN"


def test_get_current_user_no_token():
    resp = client.get("/api/auth/me")
    assert resp.status_code == 401


def test_get_current_user_invalid_token():
    resp = client.get("/api/auth/me", headers={"Authorization": "Bearer invalid.token.here"})
    assert resp.status_code == 401


# ─── 11-12: Admin user CRUD ───────────────────────────────────────────────

def test_admin_can_create_new_user(admin_token, db):
    # Cleanup leftover from previous run
    existing = db.query(User).filter(User.username == "rbac_test_emp").first()
    if existing:
        db.delete(existing)
        db.commit()

    resp = client.post(
        "/api/admin/users",
        json={
            "username": "rbac_test_emp",
            "email": "rbac_test_emp@example.com",
            "password": "testpass123",
            "role_id": 3,
            "full_name": "RBAC Test Employee"
        },
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert resp.status_code == 201
    created = resp.json()
    assert created["username"] == "rbac_test_emp"
    assert created["role_name"] in ("STAFF", "LIBRARIAN", "ADMIN")
    assert created["is_active"] is True


def test_duplicate_username_rejected(admin_token):
    resp = client.post(
        "/api/admin/users",
        json={
            "username": "admin",          # already exists
            "email": "another@example.com",
            "password": "pass123",
            "role_id": 1,
            "full_name": "Duplicate Admin"
        },
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert resp.status_code == 400
    assert "already in use" in resp.json()["detail"].lower()


# ─── 13: Last admin protection ────────────────────────────────────────────

def test_last_admin_cannot_be_deactivated(admin_token, db):
    """Cannot deactivate the only active ADMIN account."""
    # First confirm only one ADMIN exists and is active (the seed account)
    admin_role = db.query(Role).filter(Role.name == "ADMIN").first()
    if not admin_role:
        pytest.skip("No ADMIN role found")
    active_admins = db.query(User).filter(
        User.role_id == admin_role.id,
        User.is_active == True
    ).all()
    if len(active_admins) != 1:
        pytest.skip("Multiple active admins present — cannot test last-admin guard")

    admin_user = active_admins[0]
    resp = client.post(
        f"/api/admin/users/{admin_user.id}/toggle-status",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert resp.status_code == 400
    assert "only active" in resp.json()["detail"].lower() or "cannot deactivate" in resp.json()["detail"].lower()


# ─── 14: Roles list ───────────────────────────────────────────────────────

def test_admin_can_list_roles(admin_token):
    resp = client.get("/api/admin/roles", headers={"Authorization": f"Bearer {admin_token}"})
    assert resp.status_code == 200
    roles = resp.json()
    assert isinstance(roles, list)
    role_names = [r["name"] for r in roles]
    assert "ADMIN" in role_names
    assert "LIBRARIAN" in role_names
    assert "STAFF" in role_names


# ─── 15: Toggle user status ───────────────────────────────────────────────

def test_toggle_non_admin_user_status(admin_token, db):
    """Admin can deactivate and reactivate a non-admin user."""
    target = db.query(User).filter(User.username == "rbac_test_emp").first()
    if not target:
        pytest.skip("Test user rbac_test_emp not found (create test may have been skipped)")

    # Deactivate
    resp = client.post(
        f"/api/admin/users/{target.id}/toggle-status",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert resp.status_code == 200
    assert resp.json()["is_active"] is False

    # Reactivate
    resp2 = client.post(
        f"/api/admin/users/{target.id}/toggle-status",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert resp2.status_code == 200
    assert resp2.json()["is_active"] is True


# ─── 16: Specific Role Isolation & Operation Tests (Librarian & Staff restrictions) ───

def test_librarian_cannot_block_member(librarian_token, db):
    """Librarian must not be able to block members (HTTP 403)."""
    # Fetch any member
    from app.models.member import Member
    member = db.query(Member).first()
    assert member is not None
    resp = client.post(
        f"/api/members/{member.id}/block?reason=LibrarianAttempt",
        headers={"Authorization": f"Bearer {librarian_token}"}
    )
    assert resp.status_code == 403


def test_staff_cannot_block_member(staff_token, db):
    """Staff must not be able to block members (HTTP 403)."""
    from app.models.member import Member
    member = db.query(Member).first()
    assert member is not None
    resp = client.post(
        f"/api/members/{member.id}/block?reason=StaffAttempt",
        headers={"Authorization": f"Bearer {staff_token}"}
    )
    assert resp.status_code == 403


def test_librarian_cannot_unblock_member(librarian_token, db):
    """Librarian must not be able to unblock members (HTTP 403)."""
    from app.models.member import Member
    member = db.query(Member).first()
    assert member is not None
    resp = client.post(
        f"/api/members/{member.id}/unblock",
        headers={"Authorization": f"Bearer {librarian_token}"}
    )
    assert resp.status_code == 403


def test_librarian_cannot_assign_card(librarian_token, db):
    """Librarian must not be able to manage/assign smart cards (HTTP 403)."""
    from app.models.member import Member
    member = db.query(Member).first()
    assert member is not None
    resp = client.post(
        f"/api/members/{member.id}/assign-card",
        json={"smart_card_uid": "CARD-LIB-FAIL-01"},
        headers={"Authorization": f"Bearer {librarian_token}"}
    )
    assert resp.status_code == 403


def test_staff_cannot_assign_card(staff_token, db):
    """Staff must not be able to assign smart cards (HTTP 403)."""
    from app.models.member import Member
    member = db.query(Member).first()
    assert member is not None
    resp = client.post(
        f"/api/members/{member.id}/assign-card",
        json={"smart_card_uid": "CARD-STAFF-FAIL-01"},
        headers={"Authorization": f"Bearer {staff_token}"}
    )
    assert resp.status_code == 403


def test_admin_can_block_and_unblock_member(admin_token, db):
    """Admin is fully authorized to block and unblock members."""
    from app.models.member import Member
    member = db.query(Member).first()
    assert member is not None

    orig_status = member.status
    # Block
    resp = client.post(
        f"/api/members/{member.id}/block?reason=AdminVerification",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "blocked"

    # Unblock
    resp2 = client.post(
        f"/api/members/{member.id}/unblock",
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert resp2.status_code == 200
    assert resp2.json()["status"] == "active"

    # Restore original status if needed
    if orig_status != "active":
        client.post(f"/api/members/{member.id}/block?reason=Restore", headers={"Authorization": f"Bearer {admin_token}"})


def test_librarian_cannot_access_audit_logs(librarian_token):
    """Librarian must not be able to view system audit logs (HTTP 403)."""
    resp = client.get("/api/admin/audit-logs", headers={"Authorization": f"Bearer {librarian_token}"})
    assert resp.status_code == 403


def test_staff_cannot_access_audit_logs(staff_token):
    """Staff must not be able to view system audit logs (HTTP 403)."""
    resp = client.get("/api/admin/audit-logs", headers={"Authorization": f"Bearer {staff_token}"})
    assert resp.status_code == 403


def test_admin_can_access_audit_logs(admin_token):
    """Admin can view immutable audit logs."""
    resp = client.get("/api/admin/audit-logs", headers={"Authorization": f"Bearer {admin_token}"})
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


def test_librarian_cannot_get_admin_settings(librarian_token):
    """Librarian must not be able to view system configuration settings (HTTP 403)."""
    resp = client.get("/api/admin/settings", headers={"Authorization": f"Bearer {librarian_token}"})
    assert resp.status_code == 403


def test_staff_cannot_get_admin_settings(staff_token):
    """Staff must not be able to view system configuration settings (HTTP 403)."""
    resp = client.get("/api/admin/settings", headers={"Authorization": f"Bearer {staff_token}"})
    assert resp.status_code == 403


def test_staff_cannot_create_book(staff_token):
    """Staff cannot create catalog books (HTTP 403)."""
    resp = client.post(
        "/api/books",
        json={"isbn": "978-0-99999-999-9", "title": "Staff Book", "author_name": "Ghost", "category_code": "004"},
        headers={"Authorization": f"Bearer {staff_token}"}
    )
    assert resp.status_code == 403


def test_staff_cannot_create_member(staff_token):
    """Staff cannot register new patrons (HTTP 403)."""
    resp = client.post(
        "/api/members",
        json={"full_name": "Staff Patron", "membership_type": "student"},
        headers={"Authorization": f"Bearer {staff_token}"}
    )
    assert resp.status_code == 403


def test_librarian_can_create_member_without_card(librarian_token, db):
    """Librarian can register a patron without a smart card."""
    from app.models.member import Member
    import time
    ts = int(time.time())
    email = f"patron_{ts}@university.edu"
    resp = client.post(
        "/api/members",
        json={"full_name": f"Librarian Patron {ts}", "email": email, "membership_type": "student"},
        headers={"Authorization": f"Bearer {librarian_token}"}
    )
    assert resp.status_code == 201
    created = resp.json()
    assert created["full_name"] == f"Librarian Patron {ts}"
    assert created["smart_card_uid"] is None

    # Cleanup
    m = db.query(Member).filter(Member.id == created["id"]).first()
    if m:
        db.delete(m)
        db.commit()


def test_librarian_cannot_create_member_with_card(librarian_token):
    """Librarian cannot administer smart card UID during patron registration (HTTP 403)."""
    import time
    ts = int(time.time())
    resp = client.post(
        "/api/members",
        json={"full_name": f"Card Patron {ts}", "smart_card_uid": f"SC-LIB-FAIL-{ts}"},
        headers={"Authorization": f"Bearer {librarian_token}"}
    )
    assert resp.status_code == 403


def test_staff_can_lookup_members_and_books(staff_token, db):
    """Staff is authorized for member and book lookups (basic circulation tasks)."""
    resp_m = client.get("/api/members?limit=5", headers={"Authorization": f"Bearer {staff_token}"})
    assert resp_m.status_code == 200

    resp_b = client.get("/api/books?limit=5", headers={"Authorization": f"Bearer {staff_token}"})
    assert resp_b.status_code == 200


def test_anonymous_access_denied_on_sensitive_admin_endpoints():
    """Ensure unauthenticated/anonymous requests receive HTTP 401 on sensitive endpoints (NFR01, NFR02, FR11)."""
    # Backup & Restore
    assert client.get("/api/admin/backups").status_code == 401
    assert client.post("/api/admin/backups", json={"note": "anon_backup"}).status_code == 401
    assert client.get("/api/admin/backups/fake.db/validate").status_code == 401
    assert client.post("/api/admin/backups/fake.db/restore").status_code == 401

    # Offline Updates & Rollback
    assert client.get("/api/admin/updates/history").status_code == 401
    assert client.post("/api/admin/updates/apply", json={"package_path": "fake.tar.gz"}).status_code == 401
    assert client.post("/api/admin/updates/rollback", json={"snapshot_id": "fake"}).status_code == 401

    # User & Role Admin
    assert client.get("/api/admin/users").status_code == 401
    assert client.post("/api/admin/users", json={"username": "anon", "password": "123"}).status_code == 401
    assert client.get("/api/admin/roles").status_code == 401

    # System Settings & Audit Logs
    assert client.get("/api/admin/settings").status_code == 401
    assert client.put("/api/admin/settings", json={"max_fine_limit": "50.0"}).status_code == 401
    assert client.get("/api/admin/audit-logs").status_code == 401

    # Fine Settlement
    assert client.post("/api/circulation/fines/1/pay", json={"amount": 5.0}).status_code == 401


def test_librarian_and_staff_cannot_access_backups(librarian_token, staff_token):
    """Librarian and Staff tokens are rejected with 403 on database backup management."""
    # Librarian attempts
    resp_lib_list = client.get("/api/admin/backups", headers={"Authorization": f"Bearer {librarian_token}"})
    assert resp_lib_list.status_code == 403

    resp_lib_create = client.post("/api/admin/backups", json={"note": "Unauthorized"}, headers={"Authorization": f"Bearer {librarian_token}"})
    assert resp_lib_create.status_code == 403

    resp_lib_restore = client.post("/api/admin/backups/test.db/restore", headers={"Authorization": f"Bearer {librarian_token}"})
    assert resp_lib_restore.status_code == 403

    resp_lib_apply = client.post("/api/admin/updates/apply", json={"package_path": "fake.tar.gz"}, headers={"Authorization": f"Bearer {librarian_token}"})
    assert resp_lib_apply.status_code == 403

    # Staff attempts
    resp_staff_list = client.get("/api/admin/backups", headers={"Authorization": f"Bearer {staff_token}"})
    assert resp_staff_list.status_code == 403

    resp_staff_updates = client.get("/api/admin/updates/history", headers={"Authorization": f"Bearer {staff_token}"})
    assert resp_staff_updates.status_code == 403

    resp_staff_rollback = client.post("/api/admin/updates/rollback", json={"snapshot_id": "fake"}, headers={"Authorization": f"Bearer {staff_token}"})
    assert resp_staff_rollback.status_code == 403


def test_admin_can_access_backups(admin_token):
    """Admin token is authorized to list backups and check updates history."""
    resp_list = client.get("/api/admin/backups", headers={"Authorization": f"Bearer {admin_token}"})
    assert resp_list.status_code == 200
    assert isinstance(resp_list.json(), list)

    resp_history = client.get("/api/admin/updates/history", headers={"Authorization": f"Bearer {admin_token}"})
    assert resp_history.status_code == 200


def test_fine_payment_settlement(staff_token, db):
    """Staff or operator can settle patron fines with balance calculations, duplicate prevention, and audit logging (FR04, FR11)."""
    from app.models.circulation import Fine
    from app.models.member import Member
    from app.models.audit import AuditLog
    import time

    # Create temporary member with fine
    ts = int(time.time() * 1000)
    member = Member(
        membership_number=f"FINE-TEST-{ts}",
        full_name="Fine Settlement Test Patron",
        email=f"fine_{ts}@example.com",
        status="active",
        fine_balance=10.0
    )
    db.add(member)
    db.commit()
    db.refresh(member)

    fine = Fine(
        member_id=member.id,
        amount=10.0,
        paid_amount=0.0,
        status="unpaid",
        reason="Overdue return test fine"
    )
    db.add(fine)
    db.commit()
    db.refresh(fine)

    # 1. Partial payment ($4.00 of $10.00)
    resp_partial = client.post(
        f"/api/circulation/fines/{fine.id}/pay",
        json={"amount": 4.0},
        headers={"Authorization": f"Bearer {staff_token}"}
    )
    assert resp_partial.status_code == 200
    data_partial = resp_partial.json()
    assert data_partial["status"] == "partially_paid"
    assert data_partial["paid_amount"] == 4.0

    db.refresh(member)
    assert member.fine_balance == 6.0

    # 2. Overpayment rejection ($10.00 when only $6.00 remains)
    resp_over = client.post(
        f"/api/circulation/fines/{fine.id}/pay",
        json={"amount": 10.0},
        headers={"Authorization": f"Bearer {staff_token}"}
    )
    assert resp_over.status_code == 400

    # 3. Pay remaining balance ($6.00)
    resp_final = client.post(
        f"/api/circulation/fines/{fine.id}/pay",
        json={"amount": 6.0},
        headers={"Authorization": f"Bearer {staff_token}"}
    )
    assert resp_final.status_code == 200
    data_final = resp_final.json()
    assert data_final["status"] == "paid"
    assert data_final["paid_amount"] == 10.0

    db.refresh(member)
    assert member.fine_balance == 0.0

    # 4. Duplicate payment prevention (attempting to pay an already settled fine)
    resp_dup = client.post(
        f"/api/circulation/fines/{fine.id}/pay",
        json={"amount": 1.0},
        headers={"Authorization": f"Bearer {staff_token}"}
    )
    assert resp_dup.status_code == 400
    assert "already fully paid" in resp_dup.json()["detail"]

    # 5. Verify audit log entry was created
    audit_entry = db.query(AuditLog).filter(
        AuditLog.action == "FINE_PAYMENT_RECORDED",
        AuditLog.resource_id == str(fine.id)
    ).first()
    assert audit_entry is not None

    # Clean up test entities
    db.delete(fine)
    db.delete(member)
    db.commit()


# ─── Cleanup ──────────────────────────────────────────────────────────────

def test_cleanup_rbac_test_user(admin_token, db):
    """Remove the test account created during this session."""
    target = db.query(User).filter(User.username == "rbac_test_emp").first()
    if target:
        db.delete(target)
        db.commit()
    assert db.query(User).filter(User.username == "rbac_test_emp").first() is None
