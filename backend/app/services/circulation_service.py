from datetime import datetime, timedelta, timezone
from typing import Optional, List, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import or_, desc
from app.models.catalog import BookItem
from app.models.member import Member
from app.models.rfid import RfidTag
from app.models.circulation import CirculationTransaction, Fine
from app.models.setting import SystemSetting
from app.core.config import settings
from app.services.rules_engine import validate_checkout_rules
from app.services.audit_service import log_audit_event
from app.services.event_broadcaster import broadcaster

def get_setting_float(db: Session, key: str, default: float) -> float:
    setting = db.query(SystemSetting).filter(SystemSetting.key == key).first()
    if setting:
        try:
            return float(setting.value)
        except ValueError:
            pass
    return default

def get_setting_int(db: Session, key: str, default: int) -> int:
    setting = db.query(SystemSetting).filter(SystemSetting.key == key).first()
    if setting:
        try:
            return int(setting.value)
        except ValueError:
            pass
    return default

def resolve_member(
    db: Session,
    member_id: Optional[int] = None,
    membership_number: Optional[str] = None,
    smart_card_uid: Optional[str] = None
) -> Optional[Member]:
    if member_id:
        return db.query(Member).filter(Member.id == member_id).first()
    if membership_number:
        return db.query(Member).filter(Member.membership_number == membership_number.strip()).first()
    if smart_card_uid:
        return db.query(Member).filter(Member.smart_card_uid == smart_card_uid.strip().upper()).first()
    return None

def resolve_book_item(
    db: Session,
    accession_number: Optional[str] = None,
    barcode: Optional[str] = None,
    tag_uid: Optional[str] = None
) -> Optional[BookItem]:
    if accession_number:
        return db.query(BookItem).filter(BookItem.accession_number == accession_number.strip()).first()
    if barcode:
        return db.query(BookItem).filter(BookItem.barcode == barcode.strip()).first()
    if tag_uid:
        tag = db.query(RfidTag).filter(RfidTag.tag_uid == tag_uid.strip().upper()).first()
        if tag and tag.book_item_id:
            return db.query(BookItem).filter(BookItem.id == tag.book_item_id).first()
    return None

def checkout_book(
    db: Session,
    book_item: BookItem,
    member: Member,
    operator_user_id: Optional[int] = None,
    due_days: Optional[int] = None,
    protocol: str = "INTERNAL_UI",
    notes: Optional[str] = None
) -> CirculationTransaction:
    """
    Executes atomic book checkout within a transaction, strictly enforcing rules (AC04).
    Disarms the RFID EAS bit upon successful issue.
    """
    # 1. Enforce business rules
    allowed, reason = validate_checkout_rules(db, book_item, member)
    if not allowed:
        raise ValueError(reason)

    # 2. Determine loan duration
    loan_days = due_days or get_setting_int(db, "loan_period_days", settings.DEFAULT_LOAN_PERIOD_DAYS)
    now = datetime.now(timezone.utc)
    due_date = now + timedelta(days=loan_days)

    try:
        # 3. Create Circulation Record
        transaction = CirculationTransaction(
            transaction_type="checkout",
            book_item_id=book_item.id,
            member_id=member.id,
            operator_user_id=operator_user_id,
            protocol=protocol,
            checkout_date=now,
            due_date=due_date,
            return_date=None,
            renewal_count=0,
            fine_amount=0.0,
            notes=notes
        )
        db.add(transaction)

        # 4. Update Book Item Status
        book_item.status = "checked_out"

        # 5. Disarm RFID Tag EAS Security Bit (EAS = False -> Authorized Passage)
        if book_item.rfid_tag:
            book_item.rfid_tag.eas_bit = False
            book_item.rfid_tag.last_scanned_at = now

        # 6. Audit Logging
        log_audit_event(
            db,
            action="CIRCULATION_CHECKOUT",
            resource_type="circulation",
            resource_id=str(book_item.id),
            actor_user_id=operator_user_id,
            details={
                "accession_number": book_item.accession_number,
                "member_number": member.membership_number,
                "due_date": due_date.isoformat(),
                "protocol": protocol,
                "eas_disarmed": True if book_item.rfid_tag else False
            }
        )

        db.commit()
        db.refresh(transaction)

        # Broadcast SSE event
        broadcaster.broadcast("circulation_checkout", {
            "transaction_id": transaction.id,
            "accession_number": book_item.accession_number,
            "book_title": book_item.book.title if book_item.book else "Unknown",
            "member_name": member.full_name,
            "membership_number": member.membership_number,
            "due_date": due_date.isoformat(),
            "eas_bit": False
        })

        return transaction
    except Exception as e:
        db.rollback()
        raise

def checkin_book(
    db: Session,
    book_item: BookItem,
    operator_user_id: Optional[int] = None,
    protocol: str = "INTERNAL_UI",
    notes: Optional[str] = None
) -> CirculationTransaction:
    """
    Executes atomic book return within a transaction.
    Arms the RFID EAS bit (EAS = True) and assesses overdue fines if applicable.
    """
    # Find active loan
    transaction = db.query(CirculationTransaction).filter(
        CirculationTransaction.book_item_id == book_item.id,
        CirculationTransaction.transaction_type == "checkout",
        CirculationTransaction.return_date.is_(None)
    ).order_by(desc(CirculationTransaction.id)).first()

    if not transaction:
        raise ValueError(f"No active loan found for accession '{book_item.accession_number}'. Item status is '{book_item.status}'.")

    member = transaction.member
    now = datetime.now(timezone.utc)
    due_date = transaction.due_date

    try:
        # 1. Calculate Overdue Fine
        fine_amount = 0.0
        grace_days = get_setting_int(db, "grace_period_days", settings.DEFAULT_GRACE_PERIOD_DAYS)
        daily_rate = get_setting_float(db, "daily_overdue_fine", settings.DAILY_OVERDUE_FINE)

        # Make due_date timezone-aware if needed
        if due_date.tzinfo is None:
            due_date = due_date.replace(tzinfo=timezone.utc)

        if now > due_date + timedelta(days=grace_days):
            overdue_duration = now - due_date
            days_overdue = overdue_duration.days
            if days_overdue > 0:
                fine_amount = round(days_overdue * daily_rate, 2)

                # Create Fine Record
                fine_record = Fine(
                    member_id=member.id,
                    circulation_transaction_id=transaction.id,
                    amount=fine_amount,
                    paid_amount=0.0,
                    status="unpaid",
                    reason=f"Overdue return by {days_overdue} day(s) for '{book_item.accession_number}'",
                    assessed_date=now
                )
                db.add(fine_record)

                # Increment Member Fine Balance
                member.fine_balance += fine_amount

        # 2. Update Transaction Record
        transaction.return_date = now
        transaction.fine_amount = fine_amount
        if notes:
            transaction.notes = f"{transaction.notes or ''}; Checkin: {notes}"

        # 3. Update Book Item Status to Available
        book_item.status = "available"

        # 4. Arm RFID Tag EAS Security Bit (EAS = True -> Alarm Armed)
        if book_item.rfid_tag:
            book_item.rfid_tag.eas_bit = True
            book_item.rfid_tag.last_scanned_at = now

        # 5. Audit Logging
        log_audit_event(
            db,
            action="CIRCULATION_CHECKIN",
            resource_type="circulation",
            resource_id=str(book_item.id),
            actor_user_id=operator_user_id,
            details={
                "accession_number": book_item.accession_number,
                "member_number": member.membership_number,
                "fine_assessed": fine_amount,
                "protocol": protocol,
                "eas_armed": True if book_item.rfid_tag else False
            }
        )

        db.commit()
        db.refresh(transaction)

        # Broadcast SSE event
        broadcaster.broadcast("circulation_checkin", {
            "transaction_id": transaction.id,
            "accession_number": book_item.accession_number,
            "book_title": book_item.book.title if book_item.book else "Unknown",
            "member_name": member.full_name,
            "membership_number": member.membership_number,
            "fine_assessed": fine_amount,
            "eas_bit": True
        })

        return transaction
    except Exception as e:
        db.rollback()
        raise

def renew_book(
    db: Session,
    book_item: BookItem,
    operator_user_id: Optional[int] = None,
    additional_days: Optional[int] = None,
    protocol: str = "INTERNAL_UI"
) -> CirculationTransaction:
    """
    Renews an active loan, respecting renewal limits and patron blocked status (AC03).
    """
    transaction = db.query(CirculationTransaction).filter(
        CirculationTransaction.book_item_id == book_item.id,
        CirculationTransaction.transaction_type == "checkout",
        CirculationTransaction.return_date.is_(None)
    ).order_by(desc(CirculationTransaction.id)).first()

    if not transaction:
        raise ValueError(f"No active loan found for accession '{book_item.accession_number}' to renew.")

    member = transaction.member

    # Check member status
    if member.status.lower() in ["blocked", "suspended"]:
        raise ValueError(f"Renewal Blocked: Member '{member.full_name}' is currently {member.status}.")

    # Check max renewals
    max_renewals = get_setting_int(db, "max_renewal_count", settings.MAX_RENEWAL_COUNT)
    if transaction.renewal_count >= max_renewals:
        raise ValueError(f"Renewal Blocked: Maximum renewal limit ({max_renewals}) reached for this loan.")

    days = additional_days or get_setting_int(db, "loan_period_days", settings.DEFAULT_LOAN_PERIOD_DAYS)
    
    try:
        transaction.due_date = transaction.due_date + timedelta(days=days)
        transaction.renewal_count += 1
        transaction.protocol = protocol

        log_audit_event(
            db,
            action="CIRCULATION_RENEWAL",
            resource_type="circulation",
            resource_id=str(transaction.id),
            actor_user_id=operator_user_id,
            details={
                "accession_number": book_item.accession_number,
                "new_due_date": transaction.due_date.isoformat(),
                "renewal_count": transaction.renewal_count
            }
        )

        db.commit()
        db.refresh(transaction)

        # Broadcast SSE event
        broadcaster.broadcast("circulation_renewal", {
            "transaction_id": transaction.id,
            "accession_number": book_item.accession_number,
            "book_title": book_item.book.title if book_item.book else "Unknown",
            "member_name": member.full_name,
            "membership_number": member.membership_number,
            "new_due_date": transaction.due_date.isoformat(),
            "renewal_count": transaction.renewal_count
        })

        return transaction
    except Exception as e:
        db.rollback()
        raise

def due_date_enquiry(
    db: Session,
    book_item: BookItem
) -> Tuple[CirculationTransaction, bool, int, float]:
    """Returns loan inquiry details, overdue status, days overdue, and estimated fines."""
    transaction = db.query(CirculationTransaction).filter(
        CirculationTransaction.book_item_id == book_item.id,
        CirculationTransaction.transaction_type == "checkout",
        CirculationTransaction.return_date.is_(None)
    ).order_by(desc(CirculationTransaction.id)).first()

    if not transaction:
        raise ValueError(f"Item '{book_item.accession_number}' is not currently on loan.")

    now = datetime.now(timezone.utc)
    due_date = transaction.due_date
    if due_date.tzinfo is None:
        due_date = due_date.replace(tzinfo=timezone.utc)

    is_overdue = now > due_date
    days_overdue = (now - due_date).days if is_overdue else 0
    daily_rate = get_setting_float(db, "daily_overdue_fine", settings.DAILY_OVERDUE_FINE)
    estimated_fine = round(max(0, days_overdue) * daily_rate, 2)

    return transaction, is_overdue, days_overdue, estimated_fine
