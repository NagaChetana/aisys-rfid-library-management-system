from typing import List, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import or_, func
from app.models.member import Member
from app.models.circulation import CirculationTransaction
from app.schemas.member import MemberCreate, MemberUpdate
from app.services.audit_service import log_audit_event

def generate_membership_number(db: Session) -> str:
    count = db.query(Member).count() + 1
    return f"MEM-{count:05d}"

def get_members(
    db: Session,
    skip: int = 0,
    limit: int = 50,
    search: Optional[str] = None,
    status_filter: Optional[str] = None
) -> Tuple[List[Member], int]:
    query = db.query(Member)
    
    if search:
        search_term = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Member.full_name.ilike(search_term),
                Member.membership_number.ilike(search_term),
                Member.email.ilike(search_term),
                Member.smart_card_uid.ilike(search_term)
            )
        )
    
    if status_filter:
        query = query.filter(Member.status == status_filter)
        
    total = query.count()
    members = query.order_by(Member.id.desc()).offset(skip).limit(limit).all()
    return members, total

def get_member_by_id(db: Session, member_id: int) -> Optional[Member]:
    return db.query(Member).filter(Member.id == member_id).first()

def get_member_by_number(db: Session, membership_number: str) -> Optional[Member]:
    return db.query(Member).filter(Member.membership_number == membership_number.strip()).first()

def get_member_by_smart_card(db: Session, smart_card_uid: str) -> Optional[Member]:
    return db.query(Member).filter(Member.smart_card_uid == smart_card_uid.strip()).first()

def create_member(db: Session, member_in: MemberCreate, actor_id: Optional[int] = None) -> Member:
    mem_num = member_in.membership_number or generate_membership_number(db)
    
    # Check duplicate membership number
    if db.query(Member).filter(Member.membership_number == mem_num).first():
        raise ValueError(f"Membership number {mem_num} already exists")

    # Check duplicate smart card UID if provided
    if member_in.smart_card_uid:
        card_uid = member_in.smart_card_uid.strip().upper()
        if db.query(Member).filter(Member.smart_card_uid == card_uid).first():
            raise ValueError(f"Smart card UID {card_uid} is already assigned to another member")
    else:
        card_uid = None

    member = Member(
        membership_number=mem_num,
        full_name=member_in.full_name.strip(),
        email=member_in.email,
        phone=member_in.phone,
        smart_card_uid=card_uid,
        status="active",
        fine_balance=0.0,
        max_allowed_loans=member_in.max_allowed_loans,
        membership_type=member_in.membership_type,
        expiry_date=member_in.expiry_date
    )
    db.add(member)
    db.flush()
    log_audit_event(
        db,
        action="MEMBER_REGISTERED",
        resource_type="member",
        resource_id=str(member.id),
        actor_user_id=actor_id,
        details={"membership_number": mem_num, "full_name": member.full_name, "smart_card_uid": card_uid}
    )
    db.commit()
    db.refresh(member)
    return member

def update_member(db: Session, member_id: int, member_in: MemberUpdate, actor_id: Optional[int] = None) -> Member:
    member = get_member_by_id(db, member_id)
    if not member:
        raise ValueError(f"Member with id {member_id} not found")

    update_data = member_in.model_dump(exclude_unset=True)
    for field, val in update_data.items():
        setattr(member, field, val)

    db.flush()
    log_audit_event(
        db,
        action="MEMBER_UPDATED",
        resource_type="member",
        resource_id=str(member.id),
        actor_user_id=actor_id,
        details=update_data
    )
    db.commit()
    db.refresh(member)
    return member

def block_member(db: Session, member_id: int, reason: str, actor_id: Optional[int] = None) -> Member:
    member = get_member_by_id(db, member_id)
    if not member:
        raise ValueError(f"Member with id {member_id} not found")

    member.status = "blocked"
    db.flush()
    log_audit_event(
        db,
        action="MEMBER_BLOCKED",
        resource_type="member",
        resource_id=str(member.id),
        actor_user_id=actor_id,
        details={"reason": reason}
    )
    db.commit()
    db.refresh(member)
    return member

def unblock_member(db: Session, member_id: int, actor_id: Optional[int] = None) -> Member:
    member = get_member_by_id(db, member_id)
    if not member:
        raise ValueError(f"Member with id {member_id} not found")

    member.status = "active"
    db.flush()
    log_audit_event(
        db,
        action="MEMBER_UNBLOCKED",
        resource_type="member",
        resource_id=str(member.id),
        actor_user_id=actor_id,
        details={"status": "restored_to_active"}
    )
    db.commit()
    db.refresh(member)
    return member

def assign_smart_card(db: Session, member_id: int, smart_card_uid: str, actor_id: Optional[int] = None) -> Member:
    member = get_member_by_id(db, member_id)
    if not member:
        raise ValueError(f"Member with id {member_id} not found")

    uid = smart_card_uid.strip().upper()
    existing = db.query(Member).filter(Member.smart_card_uid == uid, Member.id != member_id).first()
    if existing:
        raise ValueError(f"Smart card UID {uid} is already assigned to member {existing.membership_number}")

    old_uid = member.smart_card_uid
    member.smart_card_uid = uid
    db.flush()
    log_audit_event(
        db,
        action="SMART_CARD_ASSIGNED",
        resource_type="member",
        resource_id=str(member.id),
        actor_user_id=actor_id,
        details={"old_uid": old_uid, "new_uid": uid}
    )
    db.commit()
    db.refresh(member)
    return member

def get_active_loans_count(db: Session, member_id: int) -> int:
    return db.query(CirculationTransaction).filter(
        CirculationTransaction.member_id == member_id,
        CirculationTransaction.transaction_type == "checkout",
        CirculationTransaction.return_date.is_(None)
    ).count()
