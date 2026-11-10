from datetime import datetime, timezone
from typing import List, Optional, Tuple, Dict, Any, Set
from sqlalchemy.orm import Session
from sqlalchemy import desc
from app.models.inventory import InventorySession, InventoryScan
from app.models.catalog import BookItem
from app.models.rfid import RfidTag
from app.schemas.inventory import (
    InventoryScanItemOut, InventoryMissingItemOut, InventorySessionDetail,
    BulkInventoryScanResult
)
from app.services.audit_service import log_audit_event
from app.services.event_broadcaster import broadcaster

def create_session(
    db: Session,
    session_name: str,
    target_shelf: str,
    operator_user_id: Optional[int] = None
) -> InventorySession:
    """Creates a new shelf inventory session and calculates expected item counts (FR06)."""
    clean_shelf = target_shelf.strip().upper()

    # Calculate expected physical items on target shelf that should be present (not checked out)
    expected_count = db.query(BookItem).filter(
        BookItem.shelf_location == clean_shelf,
        BookItem.status != "checked_out"
    ).count()

    session = InventorySession(
        session_name=session_name.strip(),
        target_shelf=clean_shelf,
        operator_user_id=operator_user_id,
        status="in_progress",
        total_expected=expected_count,
        total_scanned=0,
        total_missing=0,
        total_misplaced=0,
        started_at=datetime.now(timezone.utc),
        completed_at=None
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    log_audit_event(
        db,
        action="INVENTORY_SESSION_CREATED",
        resource_type="inventory_session",
        resource_id=str(session.id),
        actor_user_id=operator_user_id,
        details={"name": session.session_name, "target_shelf": clean_shelf, "expected": expected_count}
    )

    broadcaster.broadcast("inventory_session_started", {
        "session_id": session.id,
        "session_name": session.session_name,
        "target_shelf": session.target_shelf,
        "total_expected": session.total_expected
    })

    return session

def process_bulk_scans(
    db: Session,
    session_id: int,
    tag_uids: List[str],
    detected_shelf: Optional[str] = None
) -> BulkInventoryScanResult:
    """
    Processes simulated handheld reader sweeps over library shelves (AC05, FR06).
    Performs duplicate suppression within session and classifies each scan.
    """
    session = db.query(InventorySession).filter(InventorySession.id == session_id).first()
    if not session:
        raise ValueError(f"Inventory session #{session_id} not found.")

    if session.status != "in_progress":
        raise ValueError(f"Inventory session #{session_id} is '{session.status}' and cannot accept scans.")

    current_shelf = (detected_shelf or session.target_shelf).strip().upper()
    now = datetime.now(timezone.utc)

    # 1. Existing scanned tag UIDs in this session to suppress duplicates
    existing_tags: Set[str] = set(
        row[0] for row in db.query(InventoryScan.tag_uid).filter(
            InventoryScan.inventory_session_id == session_id
        ).all()
    )

    suppressed_duplicates = 0
    correct_count = 0
    misplaced_count = 0
    unknown_count = 0
    new_scan_items: List[InventoryScanItemOut] = []

    for raw_uid in tag_uids:
        clean_uid = raw_uid.strip().upper()
        if not clean_uid:
            continue

        # Duplicate scan suppression
        if clean_uid in existing_tags:
            suppressed_duplicates += 1
            continue

        existing_tags.add(clean_uid)

        # Lookup tag and item
        tag = db.query(RfidTag).filter(RfidTag.tag_uid == clean_uid).first()
        book_item: Optional[BookItem] = tag.book_item if tag and tag.book_item else None

        if not tag or not book_item:
            scan_status = "unknown_tag"
            expected_shelf = None
            accession = None
            title = "Unregistered / Unknown Tag"
            item_id = None
            unknown_count += 1
        else:
            item_id = book_item.id
            accession = book_item.accession_number
            title = book_item.book.title if book_item.book else "Unknown"
            expected_shelf = book_item.shelf_location

            if expected_shelf.upper() == session.target_shelf:
                scan_status = "correct"
                correct_count += 1
            else:
                scan_status = "misplaced"
                misplaced_count += 1

        scan_record = InventoryScan(
            inventory_session_id=session.id,
            tag_uid=clean_uid,
            book_item_id=item_id,
            detected_shelf=current_shelf,
            expected_shelf=expected_shelf,
            scan_status=scan_status,
            scanned_at=now
        )
        db.add(scan_record)
        db.flush()

        new_scan_items.append(
            InventoryScanItemOut(
                id=scan_record.id,
                tag_uid=clean_uid,
                book_item_id=item_id,
                accession_number=accession,
                book_title=title,
                detected_shelf=current_shelf,
                expected_shelf=expected_shelf,
                scan_status=scan_status,
                scanned_at=now
            )
        )

    # Update session aggregate counters
    session.total_scanned += len(new_scan_items)
    session.total_misplaced += misplaced_count

    db.commit()

    # Real-time SSE event broadcast
    broadcaster.broadcast("inventory_scan_update", {
        "session_id": session.id,
        "scanned_this_batch": len(new_scan_items),
        "total_scanned": session.total_scanned,
        "total_misplaced": session.total_misplaced,
        "suppressed_duplicates": suppressed_duplicates
    })

    return BulkInventoryScanResult(
        session_id=session.id,
        scanned_count=len(new_scan_items),
        suppressed_duplicates=suppressed_duplicates,
        correctly_located=correct_count,
        misplaced=misplaced_count,
        unknown_tags=unknown_count,
        items=new_scan_items
    )

def complete_session(db: Session, session_id: int) -> InventorySessionDetail:
    """Completes inventory session, resolves missing items on target shelf, and computes discrepancy metrics."""
    session = db.query(InventorySession).filter(InventorySession.id == session_id).first()
    if not session:
        raise ValueError(f"Inventory session #{session_id} not found.")

    now = datetime.now(timezone.utc)

    # 1. Gather all book_item_ids scanned in this session
    scanned_item_ids: Set[int] = set(
        row[0] for row in db.query(InventoryScan.book_item_id).filter(
            InventoryScan.inventory_session_id == session_id,
            InventoryScan.book_item_id.isnot(None)
        ).all()
    )

    # 2. Find expected items on target_shelf that were NOT scanned
    expected_items = db.query(BookItem).filter(
        BookItem.shelf_location == session.target_shelf,
        BookItem.status != "checked_out"
    ).all()

    missing_items: List[InventoryMissingItemOut] = []
    for itm in expected_items:
        if itm.id not in scanned_item_ids:
            missing_items.append(
                InventoryMissingItemOut(
                    book_item_id=itm.id,
                    accession_number=itm.accession_number,
                    barcode=itm.barcode,
                    title=itm.book.title if itm.book else "Unknown",
                    expected_shelf=itm.shelf_location,
                    tag_uid=itm.rfid_tag.tag_uid if itm.rfid_tag else None
                )
            )

    session.total_missing = min(len(missing_items), session.total_expected) if session.total_expected > 0 else len(missing_items)
    session.status = "completed"
    session.completed_at = now

    db.commit()
    db.refresh(session)

    log_audit_event(
        db,
        action="INVENTORY_SESSION_COMPLETED",
        resource_type="inventory_session",
        resource_id=str(session.id),
        details={
            "target_shelf": session.target_shelf,
            "expected": session.total_expected,
            "scanned": session.total_scanned,
            "missing": session.total_missing,
            "misplaced": session.total_misplaced
        }
    )

    broadcaster.broadcast("inventory_session_completed", {
        "session_id": session.id,
        "total_scanned": session.total_scanned,
        "total_missing": session.total_missing,
        "total_misplaced": session.total_misplaced
    })

    return get_session_detail(db, session_id)

def get_session_detail(db: Session, session_id: int) -> InventorySessionDetail:
    session = db.query(InventorySession).filter(InventorySession.id == session_id).first()
    if not session:
        raise ValueError(f"Inventory session #{session_id} not found.")

    scans = db.query(InventoryScan).filter(
        InventoryScan.inventory_session_id == session_id
    ).order_by(desc(InventoryScan.id)).all()

    scan_outs: List[InventoryScanItemOut] = []
    scanned_item_ids: Set[int] = set()

    for s in scans:
        if s.book_item_id:
            scanned_item_ids.add(s.book_item_id)
        scan_outs.append(
            InventoryScanItemOut(
                id=s.id,
                tag_uid=s.tag_uid,
                book_item_id=s.book_item_id,
                accession_number=s.book_item.accession_number if s.book_item else None,
                book_title=s.book_item.book.title if s.book_item and s.book_item.book else "Unknown",
                detected_shelf=s.detected_shelf,
                expected_shelf=s.expected_shelf,
                scan_status=s.scan_status,
                scanned_at=s.scanned_at
            )
        )

    # Compute missing items
    missing_items: List[InventoryMissingItemOut] = []
    expected_items = db.query(BookItem).filter(
        BookItem.shelf_location == session.target_shelf,
        BookItem.status != "checked_out"
    ).all()

    for itm in expected_items:
        if itm.id not in scanned_item_ids:
            missing_items.append(
                InventoryMissingItemOut(
                    book_item_id=itm.id,
                    accession_number=itm.accession_number,
                    barcode=itm.barcode,
                    title=itm.book.title if itm.book else "Unknown",
                    expected_shelf=itm.shelf_location,
                    tag_uid=itm.rfid_tag.tag_uid if itm.rfid_tag else None
                )
            )

    # For completed sessions, preserve stored metrics and ensure missing never exceeds expected
    final_missing = session.total_missing if session.status == "completed" else len(missing_items)
    if session.total_expected > 0:
        final_missing = min(final_missing, session.total_expected)

    if session.status == "completed" and len(missing_items) > final_missing:
        missing_items = missing_items[:final_missing]

    return InventorySessionDetail(
        id=session.id,
        session_name=session.session_name,
        target_shelf=session.target_shelf,
        operator_user_id=session.operator_user_id,
        status=session.status,
        total_expected=session.total_expected,
        total_scanned=session.total_scanned,
        total_missing=final_missing,
        total_misplaced=session.total_misplaced,
        started_at=session.started_at,
        completed_at=session.completed_at,
        scans=scan_outs,
        missing_items=missing_items
    )

def list_sessions(db: Session, skip: int = 0, limit: int = 50) -> Tuple[List[InventorySession], int]:
    query = db.query(InventorySession)
    total = query.count()
    items = query.order_by(desc(InventorySession.id)).offset(skip).limit(limit).all()
    return items, total
