from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import desc
from app.core.database import get_db
from app.core.security import get_current_user_optional, get_current_user, require_role
from app.models.user import User
from app.models.circulation import CirculationTransaction, Fine
from app.schemas.circulation import (
    CheckoutRequest, CheckinRequest, RenewRequest,
    CirculationTransactionOut, DueDateEnquiryOut, FineOut
)
from app.services import circulation_service
from app.services.audit_service import log_audit_event

router = APIRouter(prefix="/circulation", tags=["Circulation & Fines"])

def map_tx_to_out(t: CirculationTransaction) -> CirculationTransactionOut:
    return CirculationTransactionOut(
        id=t.id,
        transaction_type=t.transaction_type,
        book_item_id=t.book_item_id,
        accession_number=t.book_item.accession_number if t.book_item else "Unknown",
        book_title=t.book_item.book.title if t.book_item and t.book_item.book else "Unknown",
        member_id=t.member_id,
        member_name=t.member.full_name if t.member else "Unknown",
        membership_number=t.member.membership_number if t.member else "Unknown",
        operator_user_id=t.operator_user_id,
        protocol=t.protocol,
        checkout_date=t.checkout_date,
        due_date=t.due_date,
        return_date=t.return_date,
        renewal_count=t.renewal_count,
        fine_amount=t.fine_amount,
        notes=t.notes,
        eas_bit=t.book_item.rfid_tag.eas_bit if t.book_item and t.book_item.rfid_tag else None,
        created_at=t.created_at
    )

@router.post("/checkout", response_model=CirculationTransactionOut, status_code=status.HTTP_201_CREATED)
def checkout(
    req: CheckoutRequest,
    db: Session = Depends(get_db),
    user = Depends(get_current_user_optional)
):
    actor_id = user.id if user else None

    # Resolve member
    member = circulation_service.resolve_member(
        db,
        member_id=req.member_id,
        membership_number=req.membership_number,
        smart_card_uid=req.member_smart_card_uid
    )
    if not member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patron/Member record not found from provided identifier"
        )

    # Resolve item
    book_item = circulation_service.resolve_book_item(
        db,
        accession_number=req.accession_number,
        barcode=req.barcode,
        tag_uid=req.tag_uid
    )
    if not book_item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Physical book item copy not found from provided identifier (accession, barcode, or tag)"
        )

    try:
        tx = circulation_service.checkout_book(
            db,
            book_item=book_item,
            member=member,
            operator_user_id=actor_id,
            due_days=req.due_days,
            protocol=req.protocol
        )
        return map_tx_to_out(tx)
    except ValueError as e:
        # Enforced business rules (AC04)
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))

@router.post("/checkin", response_model=CirculationTransactionOut)
def checkin(
    req: CheckinRequest,
    db: Session = Depends(get_db),
    user = Depends(get_current_user_optional)
):
    actor_id = user.id if user else None

    book_item = circulation_service.resolve_book_item(
        db,
        accession_number=req.accession_number,
        barcode=req.barcode,
        tag_uid=req.tag_uid
    )
    if not book_item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Physical book item copy not found"
        )

    try:
        tx = circulation_service.checkin_book(
            db,
            book_item=book_item,
            operator_user_id=actor_id,
            protocol=req.protocol
        )
        return map_tx_to_out(tx)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

@router.post("/renew", response_model=CirculationTransactionOut)
def renew(
    req: RenewRequest,
    db: Session = Depends(get_db),
    user = Depends(get_current_user_optional)
):
    actor_id = user.id if user else None

    if req.transaction_id:
        tx = db.query(CirculationTransaction).filter(CirculationTransaction.id == req.transaction_id).first()
        if not tx:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaction not found")
        book_item = tx.book_item
    else:
        book_item = circulation_service.resolve_book_item(
            db,
            accession_number=req.accession_number,
            tag_uid=req.tag_uid
        )
        if not book_item:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item copy not found")

    try:
        tx = circulation_service.renew_book(
            db,
            book_item=book_item,
            operator_user_id=actor_id,
            additional_days=req.additional_days,
            protocol=req.protocol
        )
        return map_tx_to_out(tx)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))

@router.get("/due-date-enquiry", response_model=DueDateEnquiryOut)
def due_date_enquiry(
    accession_number: Optional[str] = Query(None),
    tag_uid: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    book_item = circulation_service.resolve_book_item(
        db,
        accession_number=accession_number,
        tag_uid=tag_uid
    )
    if not book_item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item copy not found")

    try:
        tx, is_overdue, days_overdue, estimated_fine = circulation_service.due_date_enquiry(db, book_item)
        return DueDateEnquiryOut(
            accession_number=book_item.accession_number,
            book_title=book_item.book.title,
            member_name=tx.member.full_name,
            membership_number=tx.member.membership_number,
            checkout_date=tx.checkout_date,
            due_date=tx.due_date,
            renewal_count=tx.renewal_count,
            is_overdue=is_overdue,
            days_overdue=days_overdue,
            estimated_fine=estimated_fine
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))

@router.get("/history", response_model=dict)
def get_circulation_history(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    q: Optional[str] = Query(None, description="Search term for accession, title, member, or transaction ID"),
    member_id: Optional[int] = Query(None),
    book_item_id: Optional[int] = Query(None),
    transaction_type: Optional[str] = Query(None),
    status: Optional[str] = Query(None, description="Status filter: all, active, returned, overdue"),
    protocol: Optional[str] = Query(None, description="Protocol filter: all, INTERNAL_UI, NCIP_2_0, SIP2"),
    active_only: bool = Query(False),
    db: Session = Depends(get_db)
):
    from app.models.catalog import BookItem, Book
    from app.models.member import Member
    from sqlalchemy import or_

    query = db.query(CirculationTransaction).outerjoin(
        CirculationTransaction.book_item
    ).outerjoin(
        BookItem.book
    ).outerjoin(
        CirculationTransaction.member
    )

    if q and q.strip():
        term = q.strip()
        or_clauses = [
            BookItem.accession_number.ilike(f"%{term}%"),
            Book.title.ilike(f"%{term}%"),
            Member.full_name.ilike(f"%{term}%"),
            Member.membership_number.ilike(f"%{term}%")
        ]
        if term.isdigit():
            or_clauses.append(CirculationTransaction.id == int(term))
        elif term.startswith("#") and term[1:].isdigit():
            or_clauses.append(CirculationTransaction.id == int(term[1:]))
        query = query.filter(or_(*or_clauses))

    if member_id:
        query = query.filter(CirculationTransaction.member_id == member_id)
    if book_item_id:
        query = query.filter(CirculationTransaction.book_item_id == book_item_id)
    if transaction_type and transaction_type.lower() != "all":
        query = query.filter(CirculationTransaction.transaction_type == transaction_type.lower())

    now = datetime.now(timezone.utc)
    if status and status.lower() != "all":
        st = status.lower()
        if st == "active":
            query = query.filter(CirculationTransaction.return_date.is_(None))
        elif st == "returned":
            query = query.filter(CirculationTransaction.return_date.isnot(None))
        elif st == "overdue":
            query = query.filter(CirculationTransaction.return_date.is_(None), CirculationTransaction.due_date < now)
    elif active_only:
        query = query.filter(CirculationTransaction.return_date.is_(None))

    if protocol and protocol.upper() != "ALL":
        query = query.filter(CirculationTransaction.protocol == protocol.upper())

    total = query.count()
    txs = query.order_by(desc(CirculationTransaction.id)).offset(skip).limit(limit).all()
    items = [map_tx_to_out(t) for t in txs]
    return {"items": items, "total": total, "skip": skip, "limit": limit}

@router.get("/fines", response_model=List[FineOut])
def get_fines(
    member_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    circulation_service.reconcile_member_fine_balances(db)
    query = db.query(Fine)
    if member_id:
        query = query.filter(Fine.member_id == member_id)
    if status:
        query = query.filter(Fine.status == status)

    fines = query.order_by(desc(Fine.id)).limit(100).all()
    return [
        FineOut(
            id=f.id,
            member_id=f.member_id,
            member_name=f.member.full_name if f.member else "Unknown",
            membership_number=f.member.membership_number if f.member else "Unknown",
            circulation_transaction_id=f.circulation_transaction_id,
            amount=f.amount,
            paid_amount=f.paid_amount,
            status=f.status,
            reason=f.reason,
            assessed_date=f.assessed_date,
            settled_date=f.settled_date
        )
        for f in fines
    ]

@router.post("/fines/{fine_id}/pay", response_model=FineOut)
def pay_fine(
    fine_id: int,
    payload: Optional[Dict[str, Any]] = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """Records payment or settlement of a patron fine (FR04, FR11). Requires authenticated operator. Prevents duplicate or excessive payment."""
    fine = db.query(Fine).filter(Fine.id == fine_id).first()
    if not fine:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Fine record not found")

    if fine.status == "paid":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Fine is already fully paid and settled."
        )

    remaining_due = round(fine.amount - fine.paid_amount, 2)
    if remaining_due <= 0:
        fine.status = "paid"
        if not fine.settled_date:
            fine.settled_date = datetime.now(timezone.utc)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Fine is already fully paid and settled."
        )

    payment_amount = float(payload.get("amount", remaining_due)) if payload and "amount" in payload else remaining_due
    payment_amount = round(payment_amount, 2)
    if payment_amount <= 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Payment amount must be greater than zero.")

    if payment_amount > remaining_due:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Payment amount (${payment_amount:.2f}) exceeds remaining balance (${remaining_due:.2f})."
        )

    fine.paid_amount = round(fine.paid_amount + payment_amount, 2)
    if fine.paid_amount >= fine.amount:
        fine.status = "paid"
        fine.settled_date = datetime.now(timezone.utc)
    else:
        fine.status = "partially_paid"

    # Reduce patron outstanding balance
    if fine.member:
        fine.member.fine_balance = max(0.0, round(fine.member.fine_balance - payment_amount, 2))

    log_audit_event(
        db,
        action="FINE_PAYMENT_RECORDED",
        resource_type="fine",
        resource_id=str(fine.id),
        actor_user_id=user.id if user else None,
        details={
            "member_id": fine.member_id,
            "payment_amount": payment_amount,
            "new_status": fine.status,
            "remaining_fine_balance": fine.member.fine_balance if fine.member else 0.0
        }
    )
    db.commit()
    db.refresh(fine)

    return FineOut(
        id=fine.id,
        member_id=fine.member_id,
        member_name=fine.member.full_name if fine.member else "Unknown",
        membership_number=fine.member.membership_number if fine.member else "Unknown",
        circulation_transaction_id=fine.circulation_transaction_id,
        amount=fine.amount,
        paid_amount=fine.paid_amount,
        status=fine.status,
        reason=fine.reason,
        assessed_date=fine.assessed_date,
        settled_date=fine.settled_date
    )
