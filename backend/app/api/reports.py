from datetime import datetime, timezone
from typing import List, Dict, Any
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.core.database import get_db
from app.models.catalog import Book, BookItem, Category
from app.models.member import Member
from app.models.rfid import RfidTag
from app.models.circulation import CirculationTransaction, Fine
from app.models.gate import GateEvent
from app.schemas.report import DashboardStats

router = APIRouter(prefix="/reports", tags=["Reports & Analytics"])

@router.get("/dashboard-stats", response_model=DashboardStats)
def get_dashboard_stats(db: Session = Depends(get_db)):
    total_titles = db.query(Book).count()
    total_copies = db.query(BookItem).count()
    available_copies = db.query(BookItem).filter(BookItem.status == "available").count()
    checked_out_copies = db.query(BookItem).filter(BookItem.status == "checked_out").count()
    
    # Tagged copies
    tagged_copies = db.query(RfidTag).filter(RfidTag.book_item_id.isnot(None)).count()
    tag_coverage = round((tagged_copies / total_copies * 100), 1) if total_copies > 0 else 0.0

    total_members = db.query(Member).count()
    active_members = db.query(Member).filter(Member.status == "active").count()
    blocked_members = db.query(Member).filter(Member.status == "blocked").count()

    # Loans & Overdue
    now = datetime.now(timezone.utc)
    active_loans = db.query(CirculationTransaction).filter(
        CirculationTransaction.transaction_type == "checkout",
        CirculationTransaction.return_date.is_(None)
    ).count()

    total_overdue = db.query(CirculationTransaction).filter(
        CirculationTransaction.transaction_type == "checkout",
        CirculationTransaction.return_date.is_(None),
        CirculationTransaction.due_date < now
    ).count()

    # Unpaid fines
    unpaid_fines_sum = db.query(func.sum(Fine.amount - Fine.paid_amount)).filter(
        Fine.status.in_(["unpaid", "partially_paid"])
    ).scalar() or 0.0

    # Gate alarms
    gate_alarms = db.query(GateEvent).filter(GateEvent.alarm_triggered == True).count()

    # Category distribution
    cat_dist = (
        db.query(Category.name, func.count(BookItem.id))
        .join(Book, Book.category_id == Category.id)
        .join(BookItem, BookItem.book_id == Book.id)
        .group_by(Category.name)
        .all()
    )
    category_distribution = [{"name": row[0], "count": row[1]} for row in cat_dist]

    # Shelf distribution
    shelf_dist = (
        db.query(BookItem.shelf_location, func.count(BookItem.id))
        .group_by(BookItem.shelf_location)
        .all()
    )
    shelf_distribution = [{"shelf": row[0], "count": row[1]} for row in shelf_dist]

    # Recent transactions
    recent = (
        db.query(CirculationTransaction)
        .order_by(CirculationTransaction.created_at.desc())
        .limit(6)
        .all()
    )
    recent_transactions = [
        {
            "id": t.id,
            "type": t.transaction_type,
            "book_title": t.book_item.book.title if t.book_item and t.book_item.book else "Unknown Book",
            "accession_number": t.book_item.accession_number if t.book_item else "Unknown",
            "member_name": t.member.full_name if t.member else "Unknown Member",
            "date": t.created_at.isoformat() if t.created_at else None,
            "status": "active" if t.return_date is None else "returned"
        }
        for t in recent
    ]

    return DashboardStats(
        total_titles=total_titles,
        total_copies=total_copies,
        available_copies=available_copies,
        checked_out_copies=checked_out_copies,
        tagged_copies=tagged_copies,
        tag_coverage_percent=tag_coverage,
        total_members=total_members,
        active_members=active_members,
        blocked_members=blocked_members,
        active_loans=active_loans,
        total_overdue=total_overdue,
        total_unpaid_fines=round(unpaid_fines_sum, 2),
        gate_alarms_count=gate_alarms,
        recent_transactions=recent_transactions,
        category_distribution=category_distribution,
        shelf_distribution=shelf_distribution
    )
