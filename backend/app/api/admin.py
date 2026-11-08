import os
import shutil
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
from app.schemas.auth import UserOut, RoleOut
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

@router.get("/users", response_model=List[UserOut])
def list_users(db: Session = Depends(get_db)):
    users = db.query(User).all()
    return [
        UserOut(
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
        for u in users
    ]

@router.get("/roles", response_model=List[RoleOut])
def list_roles(db: Session = Depends(get_db)):
    return db.query(Role).all()

# --- BACKUP AND RESTORE (FR11, NFR01, AC10) ---

@router.post("/backups")
def create_database_backup(payload: Dict[str, Any] = None, db: Session = Depends(get_db)):
    """Creates a consistent online SQLite backup using sqlite3.backup API."""
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
def list_database_backups():
    """Lists all available database backups with metadata and integrity status."""
    return backup_service.list_backups()

@router.get("/backups/{filename}/validate")
def validate_database_backup(filename: str):
    """Validates the integrity of a specific backup file."""
    try:
        return backup_service.validate_backup(filename)
    except FileNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Backup file not found")
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

@router.post("/backups/{filename}/restore")
def restore_database_backup(filename: str, db: Session = Depends(get_db)):
    """Restores database from the selected verified backup file."""
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
def get_update_history():
    """Returns the log of offline updates and rollbacks."""
    return offline_update_service.read_history()

@router.post("/updates/apply")
def apply_update_package(payload: Dict[str, Any], db: Session = Depends(get_db)):
    """Applies a verified offline update package."""
    package_path = payload.get("package_path")
    if not package_path:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="package_path is required")
    try:
        return offline_update_service.apply_offline_update(package_path, db=db)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Update failed: {str(e)}")

@router.post("/updates/rollback")
def rollback_update_package(payload: Optional[Dict[str, Any]] = None, db: Session = Depends(get_db)):
    """Rolls back to pre-update snapshot."""
    snapshot_id = payload.get("snapshot_id") if payload else None
    try:
        return offline_update_service.rollback_offline_update(snapshot_id=snapshot_id, db=db)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Rollback failed: {str(e)}")

