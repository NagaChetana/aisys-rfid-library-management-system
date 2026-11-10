import io
import csv
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from app.core.database import get_db
from app.models.catalog import Book, BookItem, Category
from app.models.member import Member
from app.models.rfid import RfidTag
from app.models.circulation import CirculationTransaction, Fine
from app.models.gate import GateEvent
from app.models.audit import AuditLog
from app.models.user import User
from app.schemas.report import DashboardStats
from app.core.security import require_role
from app.services import circulation_service

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

def _export_csv_or_json(headers: List[str], rows: List[List[Any]], filename: str, format_type: str, json_records: List[Dict[str, Any]]):
    if format_type.lower() == "csv":
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(headers)
        writer.writerows(rows)
        csv_content = output.getvalue()
        return Response(
            content=csv_content,
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={filename}.csv"}
        )
    return {"total": len(json_records), "records": json_records}

# --- FILTERABLE REPORTS (FR08, AC08) ---

@router.get("/circulation")
def get_circulation_report(
    transaction_type: Optional[str] = Query(None),
    format: str = Query("json", regex="^(json|csv)$"),
    limit: int = Query(200, ge=1, le=1000),
    db: Session = Depends(get_db),
    user = Depends(require_role(["ADMIN", "LIBRARIAN"]))
):
    """Detailed filterable report for loans, renewals, returns, and overdue status (FR08)."""
    query = db.query(CirculationTransaction)
    if transaction_type:
        query = query.filter(CirculationTransaction.transaction_type == transaction_type.lower())
    
    txs = query.order_by(desc(CirculationTransaction.id)).limit(limit).all()
    headers = ["ID", "Type", "Accession Number", "Book Title", "Member Name", "Checkout Date", "Due Date", "Return Date", "Renewals"]
    rows = []
    json_records = []
    for t in txs:
        acc = t.book_item.accession_number if t.book_item else "N/A"
        title = t.book_item.book.title if t.book_item and t.book_item.book else "Unknown"
        mem = t.member.full_name if t.member else "Unknown"
        row = [
            t.id, t.transaction_type, acc, title, mem,
            t.checkout_date.isoformat() if t.checkout_date else "",
            t.due_date.isoformat() if t.due_date else "",
            t.return_date.isoformat() if t.return_date else "",
            t.renewal_count
        ]
        rows.append(row)
        json_records.append({
            "id": t.id, "transaction_type": t.transaction_type,
            "accession_number": acc, "title": title, "member_name": mem,
            "checkout_date": t.checkout_date.isoformat() if t.checkout_date else None,
            "due_date": t.due_date.isoformat() if t.due_date else None,
            "return_date": t.return_date.isoformat() if t.return_date else None,
            "renewal_count": t.renewal_count
        })

    return _export_csv_or_json(headers, rows, "circulation_report", format, json_records)

@router.get("/tagged-items")
def get_tagged_items_report(
    status: Optional[str] = Query(None),
    shelf_location: Optional[str] = Query(None),
    format: str = Query("json", regex="^(json|csv)$"),
    limit: int = Query(200, ge=1, le=1000),
    db: Session = Depends(get_db),
    user = Depends(require_role(["ADMIN", "LIBRARIAN"]))
):
    """Report of all physical items with RFID EPC bindings, EAS status, and shelf (FR08)."""
    query = db.query(RfidTag).outerjoin(BookItem, RfidTag.book_item_id == BookItem.id)
    if status:
        st = status.lower()
        if st == "damaged":
            query = query.filter(RfidTag.status == "decommissioned")
        elif st in ["active", "decommissioned"]:
            query = query.filter(RfidTag.status == st)
    if shelf_location:
        query = query.filter(BookItem.shelf_location == shelf_location)

    tags = query.order_by(desc(RfidTag.id)).limit(limit).all()
    headers = ["Tag UID", "Accession Number", "Title", "Shelf Location", "Item Status", "EAS Armed", "Last Scanned"]
    rows = []
    json_records = []
    for t in tags:
        item = t.book_item
        acc = item.accession_number if item else "N/A"
        title = item.book.title if item and item.book else "Unknown"
        shelf = item.shelf_location if item else "N/A"
        tag_or_item_status = item.status if (item and item.status) else t.status
        row = [
            t.tag_uid, acc, title, shelf,
            tag_or_item_status,
            "YES" if t.eas_bit else "NO",
            t.last_scanned_at.isoformat() if t.last_scanned_at else "Never"
        ]
        rows.append(row)
        json_records.append({
            "tag_uid": t.tag_uid, "accession_number": acc, "title": title,
            "shelf_location": shelf, "status": tag_or_item_status,
            "eas_bit": t.eas_bit, "last_scanned_at": t.last_scanned_at.isoformat() if t.last_scanned_at else None
        })

    return _export_csv_or_json(headers, rows, "tagged_items_report", format, json_records)

@router.get("/members")
def get_members_report(
    status: Optional[str] = Query(None),
    format: str = Query("json", regex="^(json|csv)$"),
    limit: int = Query(200, ge=1, le=1000),
    db: Session = Depends(get_db),
    user = Depends(require_role(["ADMIN", "LIBRARIAN"]))
):
    """Report of registered patrons, active loans count, and fine balances (FR08)."""
    query = db.query(Member)
    if status:
        query = query.filter(Member.status == status.lower())

    members = query.order_by(Member.membership_number.asc()).limit(limit).all()
    headers = ["Membership Number", "Full Name", "Email", "Status", "Max Loans", "Fine Balance ($)"]
    rows = []
    json_records = []
    for m in members:
        row = [m.membership_number, m.full_name, m.email, m.status, m.max_allowed_loans, f"{m.fine_balance:.2f}"]
        rows.append(row)
        json_records.append({
            "membership_number": m.membership_number, "full_name": m.full_name,
            "email": m.email, "status": m.status, "max_allowed_loans": m.max_allowed_loans,
            "fine_balance": m.fine_balance
        })

    return _export_csv_or_json(headers, rows, "members_report", format, json_records)

@router.get("/fines")
def get_fines_report(
    status: Optional[str] = Query(None),
    format: str = Query("json", regex="^(json|csv)$"),
    limit: int = Query(200, ge=1, le=1000),
    db: Session = Depends(get_db),
    user = Depends(require_role(["ADMIN", "LIBRARIAN"]))
):
    """Filterable ledger of assessed, paid, and outstanding fines (FR08). Read-only report."""
    query = db.query(Fine)
    if status:
        query = query.filter(Fine.status == status.lower())

    fines = query.order_by(desc(Fine.id)).limit(limit).all()
    headers = ["Fine ID", "Member Name", "Membership Number", "Amount ($)", "Paid ($)", "Status", "Reason", "Assessed Date"]
    rows = []
    json_records = []
    for f in fines:
        mem_name = f.member.full_name if f.member else "Unknown"
        mem_num = f.member.membership_number if f.member else "N/A"
        row = [f.id, mem_name, mem_num, f"{f.amount:.2f}", f"{f.paid_amount:.2f}", f.status, f.reason, f.assessed_date.isoformat() if f.assessed_date else ""]
        rows.append(row)
        json_records.append({
            "id": f.id, "member_name": mem_name, "membership_number": mem_num,
            "amount": f.amount, "paid_amount": f.paid_amount, "status": f.status,
            "reason": f.reason, "assessed_date": f.assessed_date.isoformat() if f.assessed_date else None
        })

    return _export_csv_or_json(headers, rows, "fines_ledger_report", format, json_records)

@router.get("/gate-events")
def get_gate_events_report(
    alarm_only: Optional[bool] = Query(None),
    format: str = Query("json", regex="^(json|csv)$"),
    limit: int = Query(200, ge=1, le=1000),
    db: Session = Depends(get_db),
    user = Depends(require_role(["ADMIN", "LIBRARIAN"]))
):
    """Filterable security gate event log with alarm and CCTV image records (FR08)."""
    query = db.query(GateEvent)
    if alarm_only is not None:
        query = query.filter(GateEvent.alarm_triggered == alarm_only)

    events = query.order_by(desc(GateEvent.id)).limit(limit).all()
    headers = ["Event ID", "Reader ID", "Accession Number", "Tag UID", "Timestamp", "Alarm Triggered", "EAS State", "CCTV Path"]
    rows = []
    json_records = []
    for e in events:
        row = [e.id, e.reader_id, e.accession_number or "N/A", e.tag_uid or "N/A", e.timestamp.isoformat() if e.timestamp else "", "YES" if e.alarm_triggered else "NO", e.eas_bit_state, e.cctv_image_url or "N/A"]
        rows.append(row)
        json_records.append({
            "id": e.id, "reader_id": e.reader_id, "accession_number": e.accession_number,
            "tag_uid": e.tag_uid, "timestamp": e.timestamp.isoformat() if e.timestamp else None,
            "alarm_triggered": e.alarm_triggered, "eas_bit_state": e.eas_bit_state,
            "cctv_image_path": e.cctv_image_url
        })

    return _export_csv_or_json(headers, rows, "gate_events_report", format, json_records)

@router.get("/operator-activity")
def get_operator_activity_report(
    action: Optional[str] = Query(None),
    format: str = Query("json", regex="^(json|csv)$"),
    limit: int = Query(200, ge=1, le=1000),
    db: Session = Depends(get_db),
    user = Depends(require_role(["ADMIN"]))
):
    """Operator and RFID client activity audit log report (FR08)."""
    query = db.query(AuditLog)
    if action:
        query = query.filter(AuditLog.action.ilike(f"%{action}%"))

    logs = query.order_by(desc(AuditLog.id)).limit(limit).all()
    headers = ["Log ID", "Action", "Resource Type", "Resource ID", "Actor User ID", "Timestamp"]
    rows = []
    json_records = []
    for l in logs:
        row = [l.id, l.action, l.resource_type, l.resource_id, l.actor_user_id or "System", l.timestamp.isoformat() if l.timestamp else ""]
        rows.append(row)
        json_records.append({
            "id": l.id, "action": l.action, "resource_type": l.resource_type,
            "resource_id": l.resource_id, "actor_user_id": l.actor_user_id,
            "timestamp": l.timestamp.isoformat() if l.timestamp else None
        })

    return _export_csv_or_json(headers, rows, "operator_activity_report", format, json_records)

