from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import desc
from app.core.database import get_db
from app.core.security import get_current_user_optional, require_role
from app.models.rfid import RfidTag, RfidTagHistory
from app.models.member import Member
from app.models.user import User
from app.schemas.rfid import (
    TagItemRequest, RetagRequest, RfidTagOut, RfidTagHistoryOut,
    StaffScanResult
)
from app.services import tag_service
from app.rfid import reader_service

router = APIRouter(prefix="/rfid", tags=["RFID Middleware & Hardware Simulator"])

def map_tag_to_out(t: RfidTag) -> RfidTagOut:
    return RfidTagOut(
        id=t.id,
        tag_uid=t.tag_uid,
        item_type=t.item_type,
        book_item_id=t.book_item_id,
        accession_number=t.book_item.accession_number if t.book_item else None,
        book_title=t.book_item.book.title if t.book_item and t.book_item.book else None,
        shelf_location=t.book_item.shelf_location if t.book_item else None,
        member_id=t.member_id,
        member_name=t.member.full_name if t.member else None,
        eas_bit=t.eas_bit,
        status=t.status,
        last_scanned_at=t.last_scanned_at,
        created_at=t.created_at
    )

@router.get("/tags", response_model=dict)
def list_tags(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    q: Optional[str] = Query(None, description="Search by tag UID or accession"),
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    query = db.query(RfidTag)
    if status:
        query = query.filter(RfidTag.status == status)
    if q:
        search_term = f"%{q.strip().upper()}%"
        query = query.filter(RfidTag.tag_uid.ilike(search_term))

    total = query.count()
    tags = query.order_by(desc(RfidTag.id)).offset(skip).limit(limit).all()
    items = [map_tag_to_out(t) for t in tags]
    return {"items": items, "total": total, "skip": skip, "limit": limit}

@router.post("/tag-item", response_model=RfidTagOut, status_code=status.HTTP_201_CREATED)
def tag_book_item(
    req: TagItemRequest,
    db: Session = Depends(get_db),
    user = Depends(get_current_user_optional)
):
    actor_id = user.id if user else None
    try:
        tag = tag_service.tag_book_item(
            db,
            book_item_id=req.book_item_id,
            tag_uid=req.tag_uid,
            eas_bit=req.eas_bit,
            actor_id=actor_id
        )
        return map_tag_to_out(tag)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

@router.post("/retag", response_model=RfidTagOut)
def retag_book_item(
    req: RetagRequest,
    db: Session = Depends(get_db),
    user = Depends(get_current_user_optional)
):
    actor_id = user.id if user else None
    try:
        tag = tag_service.retag_book_item(
            db,
            book_item_id=req.book_item_id,
            new_tag_uid=req.new_tag_uid,
            reason=req.reason,
            actor_id=actor_id
        )
        return map_tag_to_out(tag)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

@router.get("/history", response_model=List[RfidTagHistoryOut])
def get_tag_history(
    book_item_id: Optional[int] = Query(None),
    tag_uid: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    history = tag_service.get_tag_history(db, book_item_id=book_item_id, tag_uid=tag_uid)
    return [
        RfidTagHistoryOut(
            id=h.id,
            tag_uid=h.tag_uid,
            item_type=h.item_type,
            book_item_id=h.book_item_id,
            member_id=h.member_id,
            assigned_at=h.assigned_at,
            deassigned_at=h.deassigned_at,
            deassignment_reason=h.deassignment_reason,
            actor_user_id=h.actor_user_id
        )
        for h in history
    ]

@router.post("/simulate/staff-scan", response_model=StaffScanResult)
def simulate_staff_scan(
    payload: dict,
    db: Session = Depends(get_db)
):
    """
    Virtual Staff Desktop Reader simulation (FR03, AC02).
    Processes multiple RFID tags placed on the desktop antenna with duplicate suppression.
    """
    tag_uids = payload.get("tag_uids", [])
    reader_id = payload.get("reader_id", "STAFF-PAD-01")
    enforce_dedup = payload.get("enforce_dedup", True)

    result = reader_service.simulate_staff_pad_scan(
        db,
        tag_uids=tag_uids,
        reader_id=reader_id,
        enforce_dedup=enforce_dedup
    )
    return result

@router.post("/simulate/smart-card-tap")
def simulate_smart_card_tap(
    payload: dict,
    db: Session = Depends(get_db)
):
    """
    Simulates tapping an NFC / 13.56MHz Smart Card at any desk reader (AC07).
    Resolves whether the card belongs to staff (user) or a library patron (member).
    """
    card_uid = payload.get("smart_card_uid", "").strip().upper()
    if not card_uid:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="smart_card_uid is required")

    # 1. Check Staff Accounts
    user = db.query(User).filter(User.smart_card_uid == card_uid).first()
    if user:
        return {
            "entity_type": "staff",
            "id": user.id,
            "username": user.username,
            "full_name": user.full_name,
            "role": user.role.name if user.role else "STAFF",
            "is_active": user.is_active,
            "smart_card_uid": card_uid
        }

    # 2. Check Patron Members
    member = db.query(Member).filter(Member.smart_card_uid == card_uid).first()
    if member:
        return {
            "entity_type": "member",
            "id": member.id,
            "membership_number": member.membership_number,
            "full_name": member.full_name,
            "status": member.status,
            "fine_balance": member.fine_balance,
            "smart_card_uid": card_uid
        }

    return {
        "entity_type": "unknown",
        "smart_card_uid": card_uid,
        "detail": "Card UID is unassigned."
    }
