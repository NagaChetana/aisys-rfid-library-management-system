#!/usr/bin/env python3
"""
AISYS RFID LMS - Offline Lifecycle & Operations Manager (Complying with FR11, FR12, NFR01, NFR03)
Provides offline CLI operations for:
- Database backup creation & validation
- Database restoration from backup
- Offline update package creation with SHA-256 manifest
- Offline update package verification & application
- Immediate rollback to pre-update snapshot
"""
import sys
import os
import argparse
import json

# Add backend directory to sys.path
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BACKEND_DIR = os.path.join(BASE_DIR, "backend")
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from app.services.backup_service import create_backup, list_backups, validate_backup, restore_backup
from app.services.offline_update_service import (
    create_update_package, verify_package, apply_offline_update,
    rollback_offline_update, read_history, get_current_app_version
)

def main():
    parser = argparse.ArgumentParser(description="AISYS RFID LMS Offline Lifecycle Manager")
    subparsers = parser.add_subparsers(dest="command", required=True)

    # Backup command
    backup_parser = subparsers.add_parser("backup", help="Create a consistent SQLite online backup")
    backup_parser.add_argument("--note", type=str, default="Manual CLI backup", help="Optional note")

    # List backups
    subparsers.add_parser("list-backups", help="List all available database backups")

    # Validate backup
    val_parser = subparsers.add_parser("validate-backup", help="Validate an existing database backup file")
    val_parser.add_argument("filename", type=str, help="Backup file name")

    # Restore backup
    restore_parser = subparsers.add_parser("restore-backup", help="Restore database from a backup file")
    restore_parser.add_argument("filename", type=str, help="Backup file name")

    # Version
    subparsers.add_parser("version", help="Print current application version")

    # Package update
    pkg_parser = subparsers.add_parser("create-package", help="Create an offline update package")
    pkg_parser.add_argument("--version", type=str, required=True, help="Target version string (e.g. 1.0.1)")
    pkg_parser.add_argument("--notes", type=str, default="Offline patch release", help="Release notes")
    pkg_parser.add_argument("--files", nargs="+", required=True, help="Key=Value mapping: target_relative=source_file")

    # Verify update
    ver_parser = subparsers.add_parser("verify-package", help="Verify offline update package integrity")
    ver_parser.add_argument("package_path", type=str, help="Path to .tar.gz update package")

    # Apply update
    app_parser = subparsers.add_parser("apply-update", help="Apply an offline update package")
    app_parser.add_argument("package_path", type=str, help="Path to .tar.gz update package")

    # Rollback update
    rb_parser = subparsers.add_parser("rollback-update", help="Roll back application to pre-update snapshot")
    rb_parser.add_argument("--snapshot-id", type=str, default=None, help="Specific snapshot ID or latest")

    # History
    subparsers.add_parser("update-history", help="Show update and rollback history")

    args = parser.parse_args()

    if args.command == "backup":
        res = create_backup(note=args.note)
        print(f"[SUCCESS] Consistent backup created: {res['filename']}")
        print(f"  SHA-256: {res['sha256']}")
        print(f"  Size: {res['size_kb']} KB")
        print(f"  Integrity: {res['integrity_check']}")

    elif args.command == "list-backups":
        backups = list_backups()
        print(f"Available Backups ({len(backups)}):")
        for b in backups:
            print(f"- {b['filename']} | {b['size_kb']} KB | Integrity: {b['integrity_check']} | {b['created_at']}")

    elif args.command == "validate-backup":
        res = validate_backup(args.filename)
        print(f"Backup Validation: {res['filename']}")
        print(f"  Valid: {res['is_valid']}")
        print(f"  Integrity Check: {res['integrity_check']}")
        print(f"  SHA-256: {res['sha256']}")

    elif args.command == "restore-backup":
        res = restore_backup(args.filename)
        print(f"[SUCCESS] {res['message']}")
        print(f"  Post-restore integrity: {res['integrity_check']}")
        print(f"  Restored record counts: {json.dumps(res['record_counts'], indent=2)}")

    elif args.command == "version":
        print(f"Current Application Version: v{get_current_app_version()}")

    elif args.command == "create-package":
        files_dict = {}
        for item in args.files:
            if "=" in item:
                target_rel, src = item.split("=", 1)
                files_dict[target_rel] = src
            else:
                files_dict[item] = item
        res = create_update_package(args.version, args.notes, files_dict)
        print(f"[SUCCESS] Update package generated: {res['package_name']}")
        print(f"  Target Version: v{res['target_version']}")
        print(f"  SHA-256: {res['sha256']}")
        print(f"  Files: {res['file_count']}")

    elif args.command == "verify-package":
        res = verify_package(args.package_path)
        if res["is_valid"]:
            print(f"[PASS] Package is valid and verified.")
            print(f"  Target Version: v{res['target_version']}")
            print(f"  Files: {res['file_count']}")
            print(f"  Notes: {res['release_notes']}")
        else:
            print(f"[FAIL] Package verification failed: {res.get('error')}")
            sys.exit(1)

    elif args.command == "apply-update":
        res = apply_offline_update(args.package_path)
        print(f"[SUCCESS] {res['message']}")
        print(f"  Pre-update Snapshot: {res['snapshot_id']}")
        print(f"  Files Updated: {res['files_updated']}")

    elif args.command == "rollback-update":
        res = rollback_offline_update(args.snapshot_id)
        print(f"[SUCCESS] {res['message']}")
        print(f"  Files Restored: {res['files_restored']}")

    elif args.command == "update-history":
        hist = read_history()
        print(f"Update & Rollback History ({len(hist)} events):")
        for entry in hist:
            print(f"- {entry.get('event')} | Version: {entry.get('target_version') or entry.get('restored_version')} | Date: {entry.get('applied_at') or entry.get('rolled_back_at')}")

if __name__ == "__main__":
    main()
