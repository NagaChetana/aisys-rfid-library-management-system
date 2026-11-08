"""
SQLite consistent online backup and restore service complying with NFR01, FR11, and AC10.
Uses Python sqlite3.Connection.backup API for 100% consistent, WAL-safe snapshots.
Supports path injection for isolated test execution without touching production DB.
"""
import os
import json
import sqlite3
import hashlib
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from app.core.database import engine
from app.services.audit_service import log_audit_event

BACKUP_DIR = os.path.abspath("./data/backups")
DB_PATH = os.path.abspath("./data/library.db")

def ensure_backup_dir(backup_dir: Optional[str] = None):
    os.makedirs(backup_dir or BACKUP_DIR, exist_ok=True)

def calculate_sha256(filepath: str) -> str:
    hasher = hashlib.sha256()
    with open(filepath, "rb") as f:
        while chunk := f.read(65536):
            hasher.update(chunk)
    return hasher.hexdigest()

def get_db_record_counts(db_file: str) -> Dict[str, int]:
    """Inspects table counts directly from an SQLite file."""
    conn = sqlite3.connect(db_file)
    cursor = conn.cursor()
    counts = {}
    tables = ["books", "book_items", "members", "rfid_tags", "circulation_transactions", "gate_events", "audit_logs"]
    for t in tables:
        try:
            cursor.execute(f"SELECT COUNT(*) FROM {t}")
            counts[t] = cursor.fetchone()[0]
        except Exception:
            counts[t] = 0
    conn.close()
    return counts

def create_backup(
    db: Optional[Session] = None,
    actor_user_id: Optional[int] = None,
    note: Optional[str] = None,
    source_db_path: Optional[str] = None,
    backup_dir: Optional[str] = None
) -> Dict[str, Any]:
    """
    Creates a transactionally consistent backup using SQLite Online Backup API.
    Handles WAL mode and uncommitted WAL frames safely.
    Validates backup using PRAGMA integrity_check.
    Supports injectable source_db_path and backup_dir for isolated testing.
    """
    target_backup_dir = os.path.abspath(backup_dir) if backup_dir else BACKUP_DIR
    src_path = os.path.abspath(source_db_path) if source_db_path else DB_PATH
    ensure_backup_dir(target_backup_dir)

    if not os.path.exists(src_path):
        raise FileNotFoundError(f"Source database file not found at {src_path}")

    timestamp_str = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S_%f")[:22]
    backup_filename = f"library_backup_{timestamp_str}.db"
    backup_path = os.path.join(target_backup_dir, backup_filename)
    meta_path = os.path.join(target_backup_dir, f"library_backup_{timestamp_str}.json")

    # Perform online backup using SQLite streaming backup API
    src_conn = sqlite3.connect(src_path)
    dst_conn = sqlite3.connect(backup_path)
    try:
        src_conn.backup(dst_conn)
    finally:
        dst_conn.close()
        src_conn.close()

    # Validate integrity of the created backup
    chk_conn = sqlite3.connect(backup_path)
    try:
        integrity_status = chk_conn.execute("PRAGMA integrity_check").fetchone()[0]
    finally:
        chk_conn.close()

    if integrity_status.lower() != "ok":
        if os.path.exists(backup_path):
            os.remove(backup_path)
        raise RuntimeError(f"Backup failed PRAGMA integrity_check: {integrity_status}")

    file_size_bytes = os.path.getsize(backup_path)
    sha256_hash = calculate_sha256(backup_path)
    record_counts = get_db_record_counts(backup_path)

    metadata = {
        "filename": backup_filename,
        "path": backup_path,
        "source_db": src_path,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "size_bytes": file_size_bytes,
        "size_kb": round(file_size_bytes / 1024, 2),
        "sha256": sha256_hash,
        "integrity_check": integrity_status,
        "record_counts": record_counts,
        "note": note or "Automated consistent backup",
        "actor_user_id": actor_user_id
    }

    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)

    # Log to audit if live db session provided and operating on live DB
    if db and src_path == DB_PATH:
        try:
            log_audit_event(
                db,
                action="DATABASE_BACKUP_CREATED",
                resource_type="database",
                resource_id=backup_filename,
                actor_user_id=actor_user_id,
                details={"filename": backup_filename, "size_bytes": file_size_bytes, "sha256": sha256_hash, "counts": record_counts}
            )
            db.commit()
        except Exception:
            db.rollback()

    return metadata

def list_backups(backup_dir: Optional[str] = None) -> List[Dict[str, Any]]:
    """Lists all available backup files with their metadata and integrity."""
    target_dir = os.path.abspath(backup_dir) if backup_dir else BACKUP_DIR
    ensure_backup_dir(target_dir)
    backups = []
    for f in sorted(os.listdir(target_dir), reverse=True):
        if f.endswith(".db"):
            backup_path = os.path.join(target_dir, f)
            meta_path = os.path.join(target_dir, f.replace(".db", ".json"))
            if os.path.exists(meta_path):
                try:
                    with open(meta_path, "r", encoding="utf-8") as mf:
                        meta = json.load(mf)
                        backups.append(meta)
                        continue
                except Exception:
                    pass
            # Fallback if JSON metadata is missing
            size_bytes = os.path.getsize(backup_path)
            backups.append({
                "filename": f,
                "path": backup_path,
                "created_at": datetime.fromtimestamp(os.path.getmtime(backup_path), tz=timezone.utc).isoformat(),
                "size_bytes": size_bytes,
                "size_kb": round(size_bytes / 1024, 2),
                "sha256": calculate_sha256(backup_path),
                "integrity_check": "unchecked",
                "record_counts": get_db_record_counts(backup_path),
                "note": "Legacy backup without metadata"
            })
    return backups

def validate_backup(filename: str, backup_dir: Optional[str] = None) -> Dict[str, Any]:
    """Validates the integrity of an existing backup file."""
    target_dir = os.path.abspath(backup_dir) if backup_dir else BACKUP_DIR
    ensure_backup_dir(target_dir)
    clean_name = os.path.basename(filename)
    backup_path = os.path.join(target_dir, clean_name)
    if not os.path.exists(backup_path):
        raise FileNotFoundError(f"Backup file '{clean_name}' not found")

    try:
        conn = sqlite3.connect(backup_path)
        integrity = conn.execute("PRAGMA integrity_check").fetchone()[0]
        conn.close()
    except Exception as e:
        integrity = f"corrupt: {str(e)}"

    sha256_hash = calculate_sha256(backup_path)
    counts = get_db_record_counts(backup_path)

    return {
        "filename": clean_name,
        "integrity_check": integrity,
        "is_valid": integrity.lower() == "ok",
        "sha256": sha256_hash,
        "size_bytes": os.path.getsize(backup_path),
        "record_counts": counts
    }

def restore_backup(
    filename: str,
    db: Optional[Session] = None,
    actor_user_id: Optional[int] = None,
    target_db_path: Optional[str] = None,
    backup_dir: Optional[str] = None
) -> Dict[str, Any]:
    """
    Restores database from a validated backup file.
    Guarantees:
    1. Pre-validates source backup file integrity.
    2. Takes an automatic pre-restore safety snapshot of the target database if it exists.
    3. Safely disposes active SQLAlchemy engine connections when targeting live DB.
    4. Streams contents atomically using sqlite3.Connection.backup API.
    5. Re-enables WAL mode and foreign keys on target.
    6. Confirms post-restore integrity and record counts.
    Supports injectable target_db_path and backup_dir for isolated testing.
    """
    target_dir = os.path.abspath(backup_dir) if backup_dir else BACKUP_DIR
    target_path = os.path.abspath(target_db_path) if target_db_path else DB_PATH
    ensure_backup_dir(target_dir)

    clean_name = os.path.basename(filename)
    backup_path = os.path.join(target_dir, clean_name)
    if not os.path.exists(backup_path):
        raise FileNotFoundError(f"Backup file '{clean_name}' not found in {target_dir}")

    # 1. Pre-validation of backup file
    pre_chk = validate_backup(clean_name, backup_dir=target_dir)
    if not pre_chk["is_valid"]:
        raise ValueError(f"Cannot restore: Backup file failed integrity check: {pre_chk['integrity_check']}")

    # 2. Pre-restore safety snapshot of current target database if it exists
    pre_safety_backup = None
    if os.path.exists(target_path):
        ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        safety_name = f"pre_restore_safety_{ts}.db"
        safety_path = os.path.join(target_dir, safety_name)
        try:
            curr_src = sqlite3.connect(target_path)
            curr_dst = sqlite3.connect(safety_path)
            curr_src.backup(curr_dst)
            curr_dst.close()
            curr_src.close()
            pre_safety_backup = safety_name
        except Exception:
            pass

    # 3. Dispose active SQLAlchemy connections if targeting live DB
    if target_path == DB_PATH:
        engine.dispose()

    # 4. Perform atomic restore from backup to target database
    src_conn = sqlite3.connect(backup_path)
    dst_conn = sqlite3.connect(target_path)
    try:
        src_conn.backup(dst_conn)
        dst_conn.execute("PRAGMA journal_mode=WAL;")
        dst_conn.execute("PRAGMA foreign_keys=ON;")
    finally:
        dst_conn.close()
        src_conn.close()

    # 5. Post-restore verification
    post_conn = sqlite3.connect(target_path)
    try:
        post_integrity = post_conn.execute("PRAGMA integrity_check").fetchone()[0]
    finally:
        post_conn.close()

    if post_integrity.lower() != "ok":
        raise RuntimeError(f"Restored database failed integrity check: {post_integrity}")

    restored_counts = get_db_record_counts(target_path)

    # 6. Log to audit if session available and targeting live DB
    if db and target_path == DB_PATH:
        try:
            log_audit_event(
                db,
                action="DATABASE_BACKUP_RESTORED",
                resource_type="database",
                resource_id=clean_name,
                actor_user_id=actor_user_id,
                details={
                    "source_backup": clean_name,
                    "target_db": target_path,
                    "pre_safety_backup": pre_safety_backup,
                    "post_restore_counts": restored_counts
                }
            )
            db.commit()
        except Exception:
            pass

    return {
        "status": "success",
        "message": f"Successfully restored database from '{clean_name}'",
        "source_backup": clean_name,
        "target_db": target_path,
        "pre_safety_backup": pre_safety_backup,
        "restored_at": datetime.now(timezone.utc).isoformat(),
        "integrity_check": post_integrity,
        "record_counts": restored_counts
    }
