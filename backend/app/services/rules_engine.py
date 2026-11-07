from typing import Optional, Tuple
from sqlalchemy.orm import Session
from app.models.catalog import BookItem
from app.models.member import Member
from app.models.circulation import CirculationTransaction
from app.models.setting import SystemSetting
from app.core.config import settings

def get_max_fine_limit(db: Session) -> float:
    setting = db.query(SystemSetting).filter(SystemSetting.key == "max_fine_limit").first()
    if setting:
        try:
            return float(setting.value)
        except ValueError:
            pass
    return settings.MAX_FINE_LIMIT

def validate_checkout_rules(
    db: Session,
    book_item: BookItem,
    member: Member
) -> Tuple[bool, Optional[str]]:
    """
    Validates all circulation business rules before checkout (AC04):
    1. Reference-only restriction
    2. Member blocked / suspended restriction
    3. Configurable fine threshold limit
    4. Item availability
    5. Maximum active loans limit
    """
    # 1. Reference Book Restriction (AC04)
    if book_item.is_reference_only:
        return False, f"Circulation Blocked: Accession '{book_item.accession_number}' is marked Reference Only and cannot be checked out."

    # 2. Member Blocked / Suspended Restriction (AC04)
    if member.status.lower() in ["blocked", "suspended"]:
        return False, f"Circulation Blocked: Member '{member.full_name}' ({member.membership_number}) status is '{member.status}'."

    # 3. Configurable Fine Threshold Limit (AC04)
    max_fine = get_max_fine_limit(db)
    if member.fine_balance > max_fine:
        return False, f"Circulation Blocked: Member fine balance (${member.fine_balance:.2f}) exceeds the configured limit of ${max_fine:.2f}."

    # 4. Copy Availability Check
    if book_item.status != "available":
        return False, f"Circulation Blocked: Item '{book_item.accession_number}' is currently not available (status: '{book_item.status}')."

    # 5. Maximum Allowed Loans Check
    active_loans = db.query(CirculationTransaction).filter(
        CirculationTransaction.member_id == member.id,
        CirculationTransaction.transaction_type == "checkout",
        CirculationTransaction.return_date.is_(None)
    ).count()

    if active_loans >= member.max_allowed_loans:
        return False, f"Circulation Blocked: Member has reached their maximum loan allowance ({active_loans}/{member.max_allowed_loans} active loans)."

    return True, None
