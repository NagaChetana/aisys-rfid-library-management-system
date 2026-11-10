import os
import shutil
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.core.database import get_db, engine
from app.core.config import settings
from app.models.user import User, Role
from app.models.catalog import Book, BookItem
from app.models.member import Member
from app.models.rfid import RfidTag
from app.models.circulation import CirculationTransaction
from app.models.gate import GateEvent
from app.models.audit import AuditLog
from app.schemas.auth import UserOut, RoleOut, UserCreate, UserUpdate
from app.core.security import get_password_hash, get_current_user_optional, get_current_user, require_role
from app.services.audit_service import log_audit_event
from app.services import backup_service
from app.services import offline_update_service

router = APIRouter(prefix="/admin", tags=["Administration & Health"])

@router.get("/health")
def health_check(db: Session = Depends(get_db)):
    """Health check endpoint complying with NFR07 and FR11."""
    # Check DB connectivity
    try:
        db.execute(text("SELECT 1")).scalar()
        db_status = "connected"
    except Exception as e:
        db_status = f"error: {str(e)}"

    # Check database file size and WAL mode
    db_file_path = "./data/library.db"
    file_size_bytes = os.path.getsize(db_file_path) if os.path.exists(db_file_path) else 0
    wal_file_path = "./data/library.db-wal"
    wal_size_bytes = os.path.getsize(wal_file_path) if os.path.exists(wal_file_path) else 0

    # Disk usage
    total, used, free = shutil.disk_usage(".")

    return {
        "status": "healthy" if db_status == "connected" else "degraded",
        "service": settings.PROJECT_NAME,
        "version": "1.0.0-rc1",
        "sop_compliance": "AISYS Candidate Software Development SOP",
        "database": {
            "status": db_status,
            "engine": "SQLite 3",
            "journal_mode": "WAL",
            "file_size_kb": round(file_size_bytes / 1024, 2),
            "wal_size_kb": round(wal_size_bytes / 1024, 2)
        },
        "disk": {
            "total_gb": round(total / (1024**3), 2),
            "free_gb": round(free / (1024**3), 2)
        },
        "offline_ready": True
    }

@router.get("/diagnostics")
def system_diagnostics(db: Session = Depends(get_db)):
    """Detailed diagnostics of database integrity and table counts."""
    counts = {
        "users": db.query(User).count(),
        "roles": db.query(Role).count(),
        "books": db.query(Book).count(),
        "book_items": db.query(BookItem).count(),
        "members": db.query(Member).count(),
        "rfid_tags": db.query(RfidTag).count(),
        "transactions": db.query(CirculationTransaction).count(),
        "gate_events": db.query(GateEvent).count(),
        "audit_logs": db.query(AuditLog).count()
    }
    
    # Pragma integrity check
    integrity_result = db.execute(text("PRAGMA integrity_check")).scalar()

    return {
        "counts": counts,
        "integrity_check": integrity_result,
        "system_settings": {
            "max_fine_limit": settings.MAX_FINE_LIMIT,
            "loan_period_days": settings.DEFAULT_LOAN_PERIOD_DAYS,
            "grace_period_days": settings.DEFAULT_GRACE_PERIOD_DAYS,
            "duplicate_event_window_ms": settings.DUPLICATE_EVENT_WINDOW_MS
        }
    }

def check_admin_access(user: User = Depends(get_current_user)) -> User:
    """Enforces that the actor must be authenticated and have the ADMIN role (NFR01, NFR02, FR11).
    - Missing or invalid token: HTTP 401 Unauthorized
    - Non-ADMIN role (LIBRARIAN, STAFF): HTTP 403 Forbidden
    - Valid ADMIN: Authorized
    """
    if not user.role or user.role.name != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Operation not permitted for role {user.role.name if user.role else 'None'}. Required: ADMIN"
        )
    return user

def _map_user_out(u: User) -> UserOut:
    return UserOut(
        id=u.id,
        username=u.username,
        email=u.email,
        full_name=u.full_name,
        role_id=u.role_id,
        role_name=u.role.name if u.role else None,
        smart_card_uid=u.smart_card_uid,
        is_active=u.is_active,
        created_at=u.created_at
    )

@router.get("/users", response_model=List[UserOut])
def list_users(
    db: Session = Depends(get_db),
    admin_user: Optional[User] = Depends(check_admin_access)
):
    users = db.query(User).all()
    return [_map_user_out(u) for u in users]

@router.post("/users", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_user(
    payload: UserCreate,
    db: Session = Depends(get_db),
    admin_user: Optional[User] = Depends(check_admin_access)
):
    """Admin provisions an individual employee account with securely hashed password and role (RBAC)."""
    # 1. Check duplicate username
    if db.query(User).filter(User.username == payload.username.strip()).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Username '{payload.username}' is already in use."
        )

    # 2. Check duplicate email
    if db.query(User).filter(User.email == payload.email.strip()).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Email '{payload.email}' is already registered."
        )

    # 3. Check role exists
    role = db.query(Role).filter(Role.id == payload.role_id).first()
    if not role:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Role ID {payload.role_id} does not exist."
        )

    # 4. Check smart card UID if provided
    card_uid = payload.smart_card_uid.strip().upper() if payload.smart_card_uid else None
    if card_uid:
        existing_card = db.query(User).filter(User.smart_card_uid == card_uid).first()
        if existing_card:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Smart card UID '{card_uid}' is already assigned to user '{existing_card.username}'."
            )

    # 5. Create user
    new_user = User(
        username=payload.username.strip(),
        email=payload.email.strip(),
        password_hash=get_password_hash(payload.password),
        role_id=role.id,
        full_name=payload.full_name.strip(),
        smart_card_uid=card_uid,
        is_active=True
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    log_audit_event(
        db,
        action="USER_CREATED",
        resource_type="user",
        resource_id=str(new_user.id),
        actor_user_id=admin_user.id if admin_user else None,
        details={"username": new_user.username, "role": role.name, "smart_card_uid": card_uid}
    )
    db.commit()

    return _map_user_out(new_user)

@router.put("/users/{user_id}", response_model=UserOut)
def update_user(
    user_id: int,
    payload: UserUpdate,
    db: Session = Depends(get_db),
    admin_user: Optional[User] = Depends(check_admin_access)
):
    """Admin updates employee account details, role assignment, or smart card badge."""
    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User account not found.")

    changes = {}
    if payload.full_name is not None and payload.full_name.strip():
        target_user.full_name = payload.full_name.strip()
        changes["full_name"] = target_user.full_name

    if payload.email is not None and payload.email.strip() != target_user.email:
        existing_email = db.query(User).filter(User.email == payload.email.strip(), User.id != user_id).first()
        if existing_email:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email is already used by another account.")
        target_user.email = payload.email.strip()
        changes["email"] = target_user.email

    if payload.role_id is not None:
        role = db.query(Role).filter(Role.id == payload.role_id).first()
        if not role:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Role ID {payload.role_id} not found.")
        target_user.role_id = role.id
        changes["role"] = role.name

    if payload.smart_card_uid is not None:
        clean_uid = payload.smart_card_uid.strip().upper() if payload.smart_card_uid.strip() else None
        if clean_uid:
            existing_card = db.query(User).filter(User.smart_card_uid == clean_uid, User.id != user_id).first()
            if existing_card:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Smart card UID '{clean_uid}' already assigned.")
        target_user.smart_card_uid = clean_uid
        changes["smart_card_uid"] = clean_uid

    if payload.password is not None and payload.password.strip():
        target_user.password_hash = get_password_hash(payload.password)
        changes["password"] = "[UPDATED]"

    if payload.is_active is not None:
        target_user.is_active = payload.is_active
        changes["is_active"] = target_user.is_active

    db.commit()
    db.refresh(target_user)

    log_audit_event(
        db,
        action="USER_UPDATED",
        resource_type="user",
        resource_id=str(target_user.id),
        actor_user_id=admin_user.id if admin_user else None,
        details=changes
    )
    db.commit()

    return _map_user_out(target_user)

@router.post("/users/{user_id}/toggle-status", response_model=UserOut)
def toggle_user_status(
    user_id: int,
    db: Session = Depends(get_db),
    admin_user: Optional[User] = Depends(check_admin_access)
):
    """Deactivates or activates an employee account."""
    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User account not found.")

    if target_user.is_active:
        # Check if deactivating the last active administrator
        if target_user.role and target_user.role.name == "ADMIN":
            active_admins = db.query(User).join(Role).filter(Role.name == "ADMIN", User.is_active == True).count()
            if active_admins <= 1:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Cannot deactivate the only active System Administrator account."
                )
        target_user.is_active = False
    else:
        target_user.is_active = True

    db.commit()
    db.refresh(target_user)

    log_audit_event(
        db,
        action="USER_STATUS_TOGGLED",
        resource_type="user",
        resource_id=str(target_user.id),
        actor_user_id=admin_user.id if admin_user else None,
        details={"username": target_user.username, "new_active_status": target_user.is_active}
    )
    db.commit()

    return _map_user_out(target_user)

@router.delete("/users/{user_id}", response_model=UserOut)
def deactivate_user(
    user_id: int,
    db: Session = Depends(get_db),
    admin_user: Optional[User] = Depends(check_admin_access)
):
    """Soft deactivates an employee account."""
    return toggle_user_status(user_id=user_id, db=db, admin_user=admin_user)

@router.get("/roles", response_model=List[RoleOut])
def list_roles(
    db: Session = Depends(get_db),
    admin_user: Optional[User] = Depends(check_admin_access)
):
    return db.query(Role).all()

@router.get("/audit-logs")
def list_audit_logs(
    limit: int = 100,
    db: Session = Depends(get_db),
    admin_user: Optional[User] = Depends(check_admin_access)
):
    """Retrieves immutable system audit logs (ADMIN only, NFR01, NFR02)."""
    logs = db.query(AuditLog).order_by(AuditLog.id.desc()).limit(limit).all()
    return [
        {
            "id": l.id,
            "action": l.action,
            "resource_type": l.resource_type,
            "resource_id": l.resource_id,
            "actor_user_id": l.actor_user_id,
            "timestamp": l.timestamp.isoformat() if l.timestamp else None,
            "details": l.details
        }
        for l in logs
    ]

# --- SYSTEM SETTINGS CONFIGURATION (FR11) ---

DEFAULT_SETTINGS = [
    {"key": "max_fine_limit", "value": "15.0", "category": "circulation", "description": "Maximum fine balance before checkout blocking ($)"},
    {"key": "loan_period_days", "value": "14", "category": "circulation", "description": "Standard book loan duration in days"},
    {"key": "grace_period_days", "value": "2", "category": "circulation", "description": "Grace period before daily overdue fines begin (days)"},
    {"key": "fine_rate_per_day", "value": "0.50", "category": "circulation", "description": "Overdue fine assessed per day ($)"},
    {"key": "duplicate_event_window_ms", "value": "3000", "category": "rfid", "description": "Sliding window for duplicate RFID event suppression (ms)"},
    {"key": "notifications_enabled", "value": "true", "category": "notifications", "description": "Master switch for automated notifications"}
]

@router.get("/settings")
def get_system_settings(
    db: Session = Depends(get_db),
    admin_user: Optional[User] = Depends(check_admin_access)
):
    """Retrieves all configurable business rules and operational settings (FR11)."""
    from app.models.setting import SystemSetting
    settings_records = db.query(SystemSetting).all()
    if not settings_records:
        # Populate initial default settings
        for d in DEFAULT_SETTINGS:
            s = SystemSetting(key=d["key"], value=d["value"], category=d["category"], description=d["description"])
            db.add(s)
        db.commit()
        settings_records = db.query(SystemSetting).all()

    return [
        {
            "key": s.key,
            "value": s.value,
            "category": s.category,
            "description": s.description,
            "updated_at": s.updated_at.isoformat() if s.updated_at else None
        }
        for s in settings_records
    ]

@router.put("/settings")
def update_system_settings(
    payload: Dict[str, Any],
    db: Session = Depends(get_db),
    admin_user: Optional[User] = Depends(check_admin_access)
):
    """Updates one or more configurable system settings with audit logging (FR11)."""
    from app.models.setting import SystemSetting
    from app.services.audit_service import log_audit_event

    updated = {}
    for key, val in payload.items():
        val_str = str(val).strip()
        setting = db.query(SystemSetting).filter(SystemSetting.key == key).first()
        if setting:
            old_val = setting.value
            setting.value = val_str
            setting.updated_at = datetime.now(timezone.utc)
            updated[key] = {"old": old_val, "new": val_str}
        else:
            new_setting = SystemSetting(key=key, value=val_str, category="custom", description="Custom admin setting")
            db.add(new_setting)
            updated[key] = {"old": None, "new": val_str}

    db.commit()

    log_audit_event(
        db,
        action="SYSTEM_SETTINGS_UPDATED",
        resource_type="system_setting",
        resource_id="configuration",
        details=updated
    )
    db.commit()

    return {"message": "Settings updated successfully", "updated": updated}

# --- BACKUP AND RESTORE (FR11, NFR01, AC10) ---

@router.post("/backups")
def create_database_backup(
    payload: Optional[Dict[str, Any]] = None,
    db: Session = Depends(get_db),
    admin_user: Optional[User] = Depends(check_admin_access)
):
    """Creates a consistent online SQLite backup using sqlite3.backup API (ADMIN only)."""
    note = payload.get("note") if payload else "Admin API backup"
    try:
        result = backup_service.create_backup(db=db, note=note)
        return result
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Backup creation failed: {str(e)}"
        )

@router.get("/backups")
def list_database_backups(
    admin_user: Optional[User] = Depends(check_admin_access)
):
    """Lists all available database backups with metadata and integrity status (ADMIN only)."""
    return backup_service.list_backups()

@router.get("/backups/{filename}/validate")
def validate_database_backup(
    filename: str,
    admin_user: Optional[User] = Depends(check_admin_access)
):
    """Validates the integrity of a specific backup file (ADMIN only)."""
    try:
        return backup_service.validate_backup(filename)
    except FileNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Backup file not found")
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.post("/backups/{filename}/restore")
def restore_database_backup(
    filename: str,
    db: Session = Depends(get_db),
    admin_user: Optional[User] = Depends(check_admin_access)
):
    """Restores database from the selected verified backup file (ADMIN only)."""
    try:
        result = backup_service.restore_backup(filename=filename, db=db)
        return result
    except FileNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Backup file not found")
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Restore operation failed: {str(e)}"
        )

# --- OFFLINE LIFECYCLE, UPDATES & ROLLBACK (FR12, NFR03, AC09) ---

@router.get("/updates/version")
def get_application_version():
    """Returns the current deployed application version."""
    return {
        "version": offline_update_service.get_current_app_version(),
        "sop_compliance": "AISYS Candidate Software Development SOP",
        "offline_ready": True
    }

@router.get("/updates/history")
def get_update_history(
    admin_user: Optional[User] = Depends(check_admin_access)
):
    """Returns the normalized log of offline updates and rollbacks (ADMIN only)."""
    raw_history = offline_update_service.read_history()
    normalized = []
    for idx, item in enumerate(raw_history):
        event = item.get("event") or item.get("action") or "UPDATE"
        is_rollback = "ROLL" in str(event).upper()
        action = "rollback" if is_rollback else "apply"
        ts = item.get("applied_at") or item.get("rolled_back_at") or item.get("timestamp") or ""
        from_ver = item.get("previous_version") or item.get("from_version") or ""
        to_ver = item.get("target_version") or item.get("restored_version") or item.get("to_version") or ""
        status_val = item.get("status") or ("ROLLED_BACK" if is_rollback else "SUCCESS")
        details = item.get("details") or {
            "snapshot_id": item.get("snapshot_id"),
            "package_name": item.get("package_name"),
            "release_notes": item.get("release_notes"),
            "files_restored": item.get("files_restored")
        }
        entry = dict(item)
        entry.update({
            "id": str(item.get("snapshot_id") or f"upd-{idx}"),
            "timestamp": ts,
            "action": action,
            "from_version": from_ver,
            "to_version": to_ver,
            "status": status_val,
            "details": details
        })
        normalized.append(entry)
    return normalized

@router.post("/updates/apply")
def apply_update_package(
    payload: Dict[str, Any],
    db: Session = Depends(get_db),
    admin_user: Optional[User] = Depends(check_admin_access)
):
    """Applies a verified offline update package (ADMIN only)."""
    package_path = payload.get("package_path")
    if not package_path:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="package_path is required")
    try:
        return offline_update_service.apply_offline_update(package_path, db=db)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Update failed: {str(e)}")

@router.post("/updates/rollback")
def rollback_update_package(
    payload: Optional[Dict[str, Any]] = None,
    db: Session = Depends(get_db),
    admin_user: Optional[User] = Depends(check_admin_access)
):
    """Rolls back to pre-update snapshot (ADMIN only)."""
    snapshot_id = payload.get("snapshot_id") if payload else None
    try:
        return offline_update_service.rollback_offline_update(snapshot_id=snapshot_id, db=db)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Rollback failed: {str(e)}")

