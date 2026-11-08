"""
Batch 4 Tests: SQLite Consistent Backup/Restore & Offline Lifecycle/Rollback
Complying with NFR01 (Data Integrity), FR11 (Administration), FR12 (Offline Lifecycle), NFR03 (Compatibility).
Ensures 100% test isolation: Live database (data/library.db) is NEVER mutated during restore tests.
"""
import os
import json
import sqlite3
import tempfile
import tarfile
import pytest
from fastapi.testclient import TestClient
from main import app
from app.services import backup_service
from app.services import offline_update_service

client = TestClient(app)

def test_backup_creation_and_metadata():
    """Verify consistent online backup creation and companion JSON metadata (FR11, NFR01)."""
    res = client.post("/api/admin/backups", json={"note": "Automated Unit Test Backup"})
    assert res.status_code == 200
    data = res.json()

    assert data["filename"].startswith("library_backup_")
    assert data["filename"].endswith(".db")
    assert os.path.exists(data["path"])
    assert data["size_bytes"] > 0
    assert len(data["sha256"]) == 64
    assert data["integrity_check"].lower() == "ok"
    assert data["record_counts"]["books"] > 0

    # Verify companion metadata file
    meta_path = data["path"].replace(".db", ".json")
    assert os.path.exists(meta_path)
    with open(meta_path, "r", encoding="utf-8") as f:
        meta_json = json.load(f)
    assert meta_json["filename"] == data["filename"]
    assert meta_json["sha256"] == data["sha256"]

def test_backup_listing_and_validation():
    """Verify listing existing backups and validating integrity (FR11, NFR01)."""
    list_res = client.get("/api/admin/backups")
    assert list_res.status_code == 200
    backups = list_res.json()
    assert len(backups) >= 1

    first_backup = backups[0]["filename"]
    val_res = client.get(f"/api/admin/backups/{first_backup}/validate")
    assert val_res.status_code == 200
    val_data = val_res.json()
    assert val_data["is_valid"] is True
    assert val_data["integrity_check"].lower() == "ok"

def test_backup_restoration_isolated_temp_db_preserves_live_db():
    """
    Verify restoring from a backup restores original state and reverses mutations (NFR01, AC10).
    ISOLATION GUARANTEE: Uses a separate temporary SQLite database; NEVER touches data/library.db.
    """
    with tempfile.TemporaryDirectory() as tmpdir:
        temp_db_path = os.path.join(tmpdir, "isolated_test_library.db")
        temp_backup_dir = os.path.join(tmpdir, "backups")
        os.makedirs(temp_backup_dir, exist_ok=True)

        # 1. Initialize isolated database schema & baseline data
        conn = sqlite3.connect(temp_db_path)
        conn.execute("PRAGMA journal_mode=WAL;")
        conn.execute(
            "CREATE TABLE books (id INTEGER PRIMARY KEY, isbn TEXT, title TEXT, is_serial INTEGER DEFAULT 0);"
        )
        conn.execute(
            "CREATE TABLE members (id INTEGER PRIMARY KEY, membership_number TEXT, full_name TEXT, email TEXT);"
        )
        conn.execute(
            "INSERT INTO books (isbn, title, is_serial) VALUES ('978-0111111111', 'Baseline Architecture', 0);"
        )
        conn.execute(
            "INSERT INTO members (membership_number, full_name, email) VALUES ('MEM-001', 'Alice Baseline', 'alice@test.local');"
        )
        conn.commit()
        conn.close()

        # 2. Take baseline backup from isolated temp DB
        backup_meta = backup_service.create_backup(
            source_db_path=temp_db_path,
            backup_dir=temp_backup_dir,
            note="Isolated Baseline Backup"
        )
        assert backup_meta["integrity_check"].lower() == "ok"
        backup_filename = backup_meta["filename"]

        # 3. Simulate failure / corrupting mutations on the temporary DB
        conn = sqlite3.connect(temp_db_path)
        conn.execute("INSERT INTO books (isbn, title, is_serial) VALUES ('978-9999999999', 'Temporary Corrupt Book', 0);")
        conn.execute("UPDATE members SET full_name='CORRUPTED RECORD' WHERE membership_number='MEM-001';")
        conn.commit()
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM books")
        mutated_book_count = cursor.fetchone()[0]
        cursor.execute("SELECT full_name FROM members WHERE membership_number='MEM-001'")
        mutated_member_name = cursor.fetchone()[0]
        conn.close()

        assert mutated_book_count == 2
        assert mutated_member_name == "CORRUPTED RECORD"

        # 4. Restore baseline backup into the temporary DB
        restore_result = backup_service.restore_backup(
            filename=backup_filename,
            target_db_path=temp_db_path,
            backup_dir=temp_backup_dir
        )
        assert restore_result["status"] == "success"
        assert restore_result["integrity_check"].lower() == "ok"

        # 5. Verify mutation is completely reversed in the isolated database
        post_conn = sqlite3.connect(temp_db_path)
        post_cursor = post_conn.cursor()
        post_cursor.execute("SELECT COUNT(*) FROM books")
        restored_book_count = post_cursor.fetchone()[0]
        post_cursor.execute("SELECT COUNT(*) FROM books WHERE isbn='978-9999999999'")
        corrupt_book_found = post_cursor.fetchone()[0]
        post_cursor.execute("SELECT full_name FROM members WHERE membership_number='MEM-001'")
        restored_member_name = post_cursor.fetchone()[0]
        post_conn.close()

        assert restored_book_count == 1
        assert corrupt_book_found == 0
        assert restored_member_name == "Alice Baseline"

def test_backup_validation_failure_on_corrupt_file():
    """Verify validation detects corrupted database files (NFR01)."""
    with tempfile.TemporaryDirectory() as tmpdir:
        corrupt_db_path = os.path.join(tmpdir, "corrupt_backup.db")
        # Write invalid random header bytes to simulate damaged media
        with open(corrupt_db_path, "wb") as f:
            f.write(b"NOT_A_VALID_SQLITE_DATABASE_HEADER_CORRUPTED_BYTES" * 100)

        val_result = backup_service.validate_backup("corrupt_backup.db", backup_dir=tmpdir)
        assert val_result["is_valid"] is False
        assert val_result["integrity_check"].lower() != "ok"

def test_restore_rejection_on_invalid_backup():
    """Verify restore operation rejects corrupted backup files (NFR01, AC10)."""
    with tempfile.TemporaryDirectory() as tmpdir:
        corrupt_db_path = os.path.join(tmpdir, "corrupt_backup.db")
        target_db = os.path.join(tmpdir, "target.db")
        with open(corrupt_db_path, "wb") as f:
            f.write(b"CORRUPTED_DATA_HEADER" * 50)

        with pytest.raises(ValueError, match="integrity check"):
            backup_service.restore_backup(
                filename="corrupt_backup.db",
                target_db_path=target_db,
                backup_dir=tmpdir
            )

def test_offline_update_packaging_and_integrity_verification():
    """Verify offline update bundle creation with SHA-256 manifest and air-gapped verification (FR12, NFR03)."""
    os.makedirs("./data/updates", exist_ok=True)
    patch_file = "./data/updates/test_patch_file.txt"
    with open(patch_file, "w", encoding="utf-8") as f:
        f.write("AISYS Offline Patch Payload v1.0.1\n")

    pkg_res = offline_update_service.create_update_package(
        version="1.0.1-test",
        release_notes="Test offline security and rules patch",
        files_to_include={"data/updates/test_patch_file.txt": patch_file}
    )

    assert os.path.exists(pkg_res["package_path"])
    assert pkg_res["target_version"] == "1.0.1-test"
    assert len(pkg_res["sha256"]) == 64

    # Verify without internet
    ver_res = offline_update_service.verify_package(pkg_res["package_path"])
    assert ver_res["is_valid"] is True
    assert ver_res["target_version"] == "1.0.1-test"
    assert ver_res["file_count"] == 1

def test_offline_update_tampered_package_rejection():
    """Verify offline updater detects and rejects tampered files where checksum mismatches (FR12, NFR02)."""
    with tempfile.TemporaryDirectory() as tmpdir:
        test_file = os.path.join(tmpdir, "payload.txt")
        with open(test_file, "w", encoding="utf-8") as f:
            f.write("Original verified content\n")

        # Create package
        pkg_res = offline_update_service.create_update_package(
            version="1.0.9-tamper",
            release_notes="Tamper test",
            files_to_include={"data/updates/payload.txt": test_file}
        )
        pkg_path = pkg_res["package_path"]

        # Tamper with the package by unpacking, altering the file, and repacking without updating manifest
        extract_dir = os.path.join(tmpdir, "extract")
        with tarfile.open(pkg_path, "r:gz") as tar:
            tar.extractall(extract_dir)

        # Alter the payload content
        tampered_file = os.path.join(extract_dir, "payload", "data", "updates", "payload.txt")
        with open(tampered_file, "w", encoding="utf-8") as f:
            f.write("MALICIOUS_ALTERED_CONTENT\n")

        # Repackage with altered file but original manifest
        tampered_pkg = os.path.join(tmpdir, "tampered_pkg.tar.gz")
        with tarfile.open(tampered_pkg, "w:gz") as tar:
            tar.add(os.path.join(extract_dir, "manifest.json"), arcname="manifest.json")
            tar.add(os.path.join(extract_dir, "payload"), arcname="payload")

        # Verification must reject package
        ver_result = offline_update_service.verify_package(tampered_pkg)
        assert ver_result["is_valid"] is False
        assert "Checksum mismatch" in ver_result["error"]

def test_offline_update_apply_and_rollback():
    """Verify applying offline update, taking snapshot, and rolling back (FR12, AC09)."""
    initial_version = offline_update_service.get_current_app_version()
    os.makedirs("./data/updates", exist_ok=True)

    patch_rel_path = "data/updates/version_marker.txt"
    patch_source = "./data/updates/temp_marker.txt"
    with open(patch_source, "w", encoding="utf-8") as f:
        f.write(f"Marker content created under v{initial_version}\n")

    pkg_res = offline_update_service.create_update_package(
        version="1.1.0-test",
        release_notes="Feature update with automatic snapshot and rollback",
        files_to_include={patch_rel_path: patch_source}
    )

    # Apply update via API
    apply_res = client.post("/api/admin/updates/apply", json={"package_path": pkg_res["package_path"]})
    assert apply_res.status_code == 200
    apply_data = apply_res.json()
    assert apply_data["status"] == "success"
    assert apply_data["current_version"] == "1.1.0-test"

    # Verify version file was updated
    ver_res = client.get("/api/admin/updates/version")
    assert ver_res.status_code == 200
    assert ver_res.json()["version"] == "1.1.0-test"

    # Rollback via API
    rb_res = client.post("/api/admin/updates/rollback", json={"snapshot_id": apply_data["snapshot_id"]})
    assert rb_res.status_code == 200
    rb_data = rb_res.json()
    assert rb_data["status"] == "success"
    assert rb_data["current_version"] == initial_version

    # Confirm version returned to initial version
    assert offline_update_service.get_current_app_version() == initial_version

    # Verify history is auditable
    hist_res = client.get("/api/admin/updates/history")
    assert hist_res.status_code == 200
    hist = hist_res.json()
    assert len(hist) >= 2
    assert any(h["event"] == "UPDATE_APPLIED" for h in hist)
    assert any(h["event"] == "UPDATE_ROLLED_BACK" for h in hist)
