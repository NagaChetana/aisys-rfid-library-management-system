from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import get_current_user_optional, require_role
from app.schemas.member import MemberCreate, MemberUpdate, MemberOut, AssignCardRequest
from app.services import member_service

router = APIRouter(prefix="/members", tags=["Members & Patrons"])

def map_member_to_out(db: Session, member) -> MemberOut:
    active_loans = member_service.get_active_loans_count(db, member.id)
    return MemberOut(
        id=member.id,
        membership_number=member.membership_number,
        full_name=member.full_name,
        email=member.email,
        phone=member.phone,
        smart_card_uid=member.smart_card_uid,
        status=member.status,
        fine_balance=member.fine_balance,
        max_allowed_loans=member.max_allowed_loans,
        membership_type=member.membership_type,
        expiry_date=member.expiry_date,
        active_loans_count=active_loans,
        migration_batch_id=member.migration_batch_id,
        created_at=member.created_at,
        updated_at=member.updated_at
    )

@router.get("", response_model=dict)
def list_members(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    q: Optional[str] = Query(None, description="Search by name, number, email or card UID"),
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    members, total = member_service.get_members(
        db,
        skip=skip,
        limit=limit,
        search=q,
        status_filter=status
    )
    items = [map_member_to_out(db, m) for m in members]
    return {"items": items, "total": total, "skip": skip, "limit": limit}

@router.post("", response_model=MemberOut, status_code=status.HTTP_201_CREATED)
def create_member(
    member_in: MemberCreate,
    db: Session = Depends(get_db),
    user = Depends(require_role(["ADMIN", "LIBRARIAN"]))
):
    actor_id = user.id if user else None
    if user and user.role and user.role.name == "LIBRARIAN" and member_in.smart_card_uid:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Card administration is restricted to System Administrators"
        )
    try:
        member = member_service.create_member(db, member_in, actor_id=actor_id)
        return map_member_to_out(db, member)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

@router.get("/{id}", response_model=MemberOut)
def get_member(id: int, db: Session = Depends(get_db)):
    member = member_service.get_member_by_id(db, id)
    if not member:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Member with id {id} not found")
    return map_member_to_out(db, member)

@router.put("/{id}", response_model=MemberOut)
def update_member(
    id: int,
    member_in: MemberUpdate,
    db: Session = Depends(get_db),
    user = Depends(require_role(["ADMIN", "LIBRARIAN"]))
):
    actor_id = user.id if user else None
    if user and user.role and user.role.name == "LIBRARIAN" and member_in.smart_card_uid:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Card administration is restricted to System Administrators"
        )
    try:
        member = member_service.update_member(db, id, member_in, actor_id=actor_id)
        return map_member_to_out(db, member)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

@router.post("/{id}/block", response_model=MemberOut)
def block_member(
    id: int,
    reason: str = Query("Admin block", description="Reason for blocking member"),
    db: Session = Depends(get_db),
    user = Depends(require_role(["ADMIN"]))
):
    actor_id = user.id if user else None
    try:
        member = member_service.block_member(db, id, reason=reason, actor_id=actor_id)
        return map_member_to_out(db, member)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

@router.post("/{id}/unblock", response_model=MemberOut)
def unblock_member(
    id: int,
    db: Session = Depends(get_db),
    user = Depends(require_role(["ADMIN"]))
):
    actor_id = user.id if user else None
    try:
        member = member_service.unblock_member(db, id, actor_id=actor_id)
        return map_member_to_out(db, member)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

@router.post("/{id}/assign-card", response_model=MemberOut)
def assign_card(
    id: int,
    req: AssignCardRequest,
    db: Session = Depends(get_db),
    user = Depends(require_role(["ADMIN"]))
):
    actor_id = user.id if user else None
    try:
        member = member_service.assign_smart_card(db, id, req.smart_card_uid, actor_id=actor_id)
        return map_member_to_out(db, member)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
