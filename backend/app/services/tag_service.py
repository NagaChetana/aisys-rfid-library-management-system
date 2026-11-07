import uuid
import re
from datetime import datetime, timezone
from typing import Optional, List, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import desc
from app.models.catalog import BookItem
from app.models.member import Member
from app.models.rfid import RfidTag, RfidTagHistory
from app.services.audit_service import log_audit_event

def generate_epc(prefix: str = "E2801160") -> str:
    """Generates standard 24-character hex EPC for RFID book item (ISO 18000-6C / Gen2)."""
    random_hex = uuid.uuid4().hex[:16].upper()
    return f"{prefix}{random_hex}"

def validate_tag_format(tag_uid: str) -> bool:
    """Validates that tag UID is a valid non-empty hexadecimal string (e.g. 16-24 chars)."""
    cleaned = tag_uid.strip().upper()
    if len(cleaned) < 8 or len(cleaned) > 64:
        return False
    return bool(re.match(r"^[0-9A-F]+$", cleaned))

def tag_book_item(
    db: Session,
    book_item_id: int,
    tag_uid: Optional[str] = None,
    eas_bit: bool = True,
    actor_id: Optional[int] = None
) -> RfidTag:
    """
    Validates book item and associates a unique RFID tag (AC02, FR05).
    Guarantees duplicate tag prevention and logs to rfid_tag_history.
    """
    item = db.query(BookItem).filter(BookItem.id == book_item_id).first()
    if not item:
        raise ValueError(f"Book item with ID {book_item_id} not found.")

    # Check if item is already tagged
    existing_item_tag = db.query(RfidTag).filter(
        RfidTag.book_item_id == book_item_id,
        RfidTag.status == "active"
    ).first()
    if existing_item_tag:
        raise ValueError(f"Item '{item.accession_number}' is already tagged with EPC '{existing_item_tag.tag_uid}'. Use re-tagging for replacement.")

    # Resolve or generate tag UID
    final_uid = tag_uid.strip().upper() if tag_uid else generate_epc()
    if not validate_tag_format(final_uid):
        raise ValueError(f"Invalid tag UID format: '{final_uid}'. Must be hexadecimal characters.")

    # Duplicate tag check (FR05)
    existing_tag = db.query(RfidTag).filter(RfidTag.tag_uid == final_uid).first()
    if existing_tag:
        raise ValueError(f"Duplicate Tag Error: RFID Tag UID '{final_uid}' is already registered in the system (Status: '{existing_tag.status}').")

    now = datetime.now(timezone.utc)

    try:
        # Create Tag Record
        tag = RfidTag(
            tag_uid=final_uid,
            item_type="book_item",
            book_item_id=item.id,
            member_id=None,
            eas_bit=eas_bit,
            status="active",
            last_scanned_at=now
        )
        db.add(tag)

        # Record Tag History (User requirement: Maintain historical RFID tag assignments)
        history = RfidTagHistory(
            tag_uid=final_uid,
            item_type="book_item",
            book_item_id=item.id,
            member_id=None,
            assigned_at=now,
            deassigned_at=None,
            deassignment_reason=None,
            actor_user_id=actor_id
        )
        db.add(history)

        log_audit_event(
            db,
            action="RFID_TAG_ASSIGNED",
            resource_type="rfid_tag",
            resource_id=final_uid,
            actor_user_id=actor_id,
            details={
                "accession_number": item.accession_number,
                "book_title": item.book.title if item.book else "Unknown",
                "tag_uid": final_uid,
                "eas_bit": eas_bit
            }
        )

        db.commit()
        db.refresh(tag)
        return tag
    except Exception as e:
        db.rollback()
        raise

def retag_book_item(
    db: Session,
    book_item_id: int,
    new_tag_uid: Optional[str] = None,
    reason: str = "Damaged tag replacement",
    actor_id: Optional[int] = None
) -> RfidTag:
    """
    Decommissions existing tag and re-tags book item with full audit history (FR05, AC02).
    """
    item = db.query(BookItem).filter(BookItem.id == book_item_id).first()
    if not item:
        raise ValueError(f"Book item with ID {book_item_id} not found.")

    # Find currently active tag
    old_tag = db.query(RfidTag).filter(
        RfidTag.book_item_id == book_item_id,
        RfidTag.status == "active"
    ).first()

    now = datetime.now(timezone.utc)

    # Resolve new UID
    final_new_uid = new_tag_uid.strip().upper() if new_tag_uid else generate_epc()
    if not validate_tag_format(final_new_uid):
        raise ValueError(f"Invalid new tag UID format: '{final_new_uid}'.")

    # Check collision for new UID
    if db.query(RfidTag).filter(RfidTag.tag_uid == final_new_uid).first():
        raise ValueError(f"RFID Tag UID '{final_new_uid}' is already registered in the system.")

    try:
        if old_tag:
            # 1. Decommission old tag
            old_tag.status = "decommissioned"
            old_tag.book_item_id = None

            # 2. Update historical log for old tag
            old_history = db.query(RfidTagHistory).filter(
                RfidTagHistory.tag_uid == old_tag.tag_uid,
                RfidTagHistory.deassigned_at.is_(None)
            ).first()
            if old_history:
                old_history.deassigned_at = now
                old_history.deassignment_reason = reason

        # 3. Create new Tag
        new_tag = RfidTag(
            tag_uid=final_new_uid,
            item_type="book_item",
            book_item_id=item.id,
            member_id=None,
            eas_bit=True if item.status == "available" else False,
            status="active",
            last_scanned_at=now
        )
        db.add(new_tag)

        # 4. Insert new historical record
        new_history = RfidTagHistory(
            tag_uid=final_new_uid,
            item_type="book_item",
            book_item_id=item.id,
            member_id=None,
            assigned_at=now,
            deassigned_at=None,
            deassignment_reason=None,
            actor_user_id=actor_id
        )
        db.add(new_history)

        log_audit_event(
            db,
            action="RFID_RETAGGED",
            resource_type="rfid_tag",
            resource_id=final_new_uid,
            actor_user_id=actor_id,
            details={
                "accession_number": item.accession_number,
                "old_tag_uid": old_tag.tag_uid if old_tag else None,
                "new_tag_uid": final_new_uid,
                "reason": reason
            }
        )

        db.commit()
        db.refresh(new_tag)
        return new_tag
    except Exception as e:
        db.rollback()
        raise

def get_tag_history(db: Session, book_item_id: Optional[int] = None, tag_uid: Optional[str] = None) -> List[RfidTagHistory]:
    query = db.query(RfidTagHistory)
    if book_item_id:
        query = query.filter(RfidTagHistory.book_item_id == book_item_id)
    if tag_uid:
        query = query.filter(RfidTagHistory.tag_uid == tag_uid.strip().upper())
    return query.order_by(desc(RfidTagHistory.assigned_at)).all()
