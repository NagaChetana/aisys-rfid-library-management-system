from datetime import datetime, timezone, date
from typing import List, Optional, Tuple
import uuid
from sqlalchemy.orm import Session
from sqlalchemy import desc, func
from app.models.acquisition import Supplier, PurchaseOrder, PurchaseOrderItem, SerialSubscription, SerialIssue
from app.models.catalog import Book, BookItem, Author, Category
from app.schemas.acquisition import (
    SupplierCreate, PurchaseOrderCreate, ReceiveOrderItemRequest,
    SerialSubscriptionCreate, SerialIssueCreate
)
from app.services.audit_service import log_audit_event
from app.services.catalog_service import generate_accession_number, generate_barcode, get_or_create_author, get_or_create_category

def create_supplier(db: Session, data: SupplierCreate, actor_id: Optional[int] = None) -> Supplier:
    supplier = Supplier(
        name=data.name.strip(),
        contact_person=data.contact_person,
        email=data.email,
        phone=data.phone,
        address=data.address,
        is_active=data.is_active
    )
    db.add(supplier)
    db.commit()
    db.refresh(supplier)

    log_audit_event(
        db,
        action="SUPPLIER_CREATED",
        resource_type="supplier",
        resource_id=str(supplier.id),
        actor_user_id=actor_id,
        details={"name": supplier.name, "contact": supplier.contact_person}
    )
    db.commit()
    return supplier

def list_suppliers(db: Session, skip: int = 0, limit: int = 100) -> List[Supplier]:
    return db.query(Supplier).order_by(Supplier.name.asc()).offset(skip).limit(limit).all()

def create_purchase_order(db: Session, data: PurchaseOrderCreate, actor_id: Optional[int] = None) -> PurchaseOrder:
    supplier = db.query(Supplier).filter(Supplier.id == data.supplier_id).first()
    if not supplier:
        raise ValueError(f"Supplier ID {data.supplier_id} not found.")

    po_count = db.query(func.count(PurchaseOrder.id)).scalar() or 0
    po_number = f"PO-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{po_count + 1:04d}"

    total_cost = sum(item.quantity * item.unit_price for item in data.items)

    po = PurchaseOrder(
        po_number=po_number,
        supplier_id=supplier.id,
        order_date=datetime.now(timezone.utc).date(),
        expected_delivery_date=data.expected_delivery_date,
        status="ordered",
        total_cost=round(total_cost, 2),
        notes=data.notes
    )
    db.add(po)
    db.flush()

    for item in data.items:
        po_item = PurchaseOrderItem(
            purchase_order_id=po.id,
            title=item.title.strip(),
            author=item.author.strip() if item.author else None,
            isbn=item.isbn.strip() if item.isbn else None,
            quantity=item.quantity,
            unit_price=item.unit_price,
            received_quantity=0
        )
        db.add(po_item)

    db.commit()
    db.refresh(po)

    log_audit_event(
        db,
        action="PURCHASE_ORDER_CREATED",
        resource_type="purchase_order",
        resource_id=po.po_number,
        actor_user_id=actor_id,
        details={"po_number": po.po_number, "supplier_name": supplier.name, "total_cost": po.total_cost, "items_count": len(data.items)}
    )
    db.commit()
    return po

def list_purchase_orders(db: Session, skip: int = 0, limit: int = 50) -> List[PurchaseOrder]:
    return db.query(PurchaseOrder).order_by(desc(PurchaseOrder.id)).offset(skip).limit(limit).all()

def receive_purchase_order_item(
    db: Session,
    po_id: int,
    req: ReceiveOrderItemRequest,
    actor_id: Optional[int] = None
) -> Tuple[PurchaseOrder, List[str]]:
    po = db.query(PurchaseOrder).filter(PurchaseOrder.id == po_id).first()
    if not po:
        raise ValueError(f"Purchase Order ID {po_id} not found.")

    item = db.query(PurchaseOrderItem).filter(
        PurchaseOrderItem.id == req.item_id,
        PurchaseOrderItem.purchase_order_id == po_id
    ).first()
    if not item:
        raise ValueError(f"Order line item ID {req.item_id} not found in PO {po.po_number}.")

    if item.received_quantity + req.quantity_to_receive > item.quantity:
        raise ValueError(
            f"Cannot receive {req.quantity_to_receive} items. "
            f"Already received {item.received_quantity}/{item.quantity}."
        )

    item.received_quantity += req.quantity_to_receive

    # Check overall PO status
    all_items = po.items
    total_ordered = sum(i.quantity for i in all_items)
    total_received = sum(i.received_quantity for i in all_items)
    if total_received >= total_ordered:
        po.status = "received"
    elif total_received > 0:
        po.status = "partially_received"

    created_accessions = []
    # If create_catalog_records is True, instantiate Book / BookItems
    if req.create_catalog_records:
        author = get_or_create_author(db, item.author or "Unknown Author")
        category = get_or_create_category(db, "000", "General Works")

        # Find or create book
        book = None
        if item.isbn:
            book = db.query(Book).filter(Book.isbn == item.isbn).first()
        if not book:
            temp_isbn = item.isbn or f"ACQ-{uuid.uuid4().hex[:10].upper()}"
            book = Book(
                isbn=temp_isbn,
                title=item.title,
                author_id=author.id,
                category_id=category.id,
                publisher=po.supplier.name,
                publish_year=datetime.now(timezone.utc).year,
                call_number=f"000 {author.name[:3].upper()}"
            )
            db.add(book)
            db.flush()

        for i in range(req.quantity_to_receive):
            acc_num = generate_accession_number(db, offset=i)
            bc = generate_barcode(db, offset=i)
            existing_copies_count = len(book.items)
            book_item = BookItem(
                book_id=book.id,
                accession_number=acc_num,
                barcode=bc,
                copy_number=existing_copies_count + 1,
                shelf_location=req.shelf_location,
                status="available",
                is_reference_only=False,
                price=item.unit_price
            )
            db.add(book_item)
            db.flush()
            created_accessions.append(acc_num)

    db.commit()
    db.refresh(po)

    log_audit_event(
        db,
        action="PURCHASE_ORDER_ITEM_RECEIVED",
        resource_type="purchase_order",
        resource_id=po.po_number,
        actor_user_id=actor_id,
        details={
            "po_number": po.po_number,
            "line_item_title": item.title,
            "received_quantity": req.quantity_to_receive,
            "created_accessions": created_accessions
        }
    )
    db.commit()
    return po, created_accessions

# --- SERIALS & PERIODICALS MANAGEMENT ---

def create_serial_subscription(
    db: Session,
    data: SerialSubscriptionCreate,
    actor_id: Optional[int] = None
) -> SerialSubscription:
    sub = SerialSubscription(
        subscription_code=data.subscription_code.strip().upper(),
        title=data.title.strip(),
        issn=data.issn.strip() if data.issn else None,
        supplier_id=data.supplier_id,
        frequency=data.frequency,
        start_date=data.start_date,
        end_date=data.end_date,
        annual_cost=data.annual_cost,
        status="active",
        shelf_location=data.shelf_location
    )
    db.add(sub)
    db.commit()
    db.refresh(sub)

    log_audit_event(
        db,
        action="SERIAL_SUBSCRIPTION_CREATED",
        resource_type="serial_subscription",
        resource_id=sub.subscription_code,
        actor_user_id=actor_id,
        details={"title": sub.title, "frequency": sub.frequency}
    )
    db.commit()
    return sub

def list_serial_subscriptions(db: Session) -> List[SerialSubscription]:
    return db.query(SerialSubscription).order_by(SerialSubscription.title.asc()).all()

def receive_serial_issue(
    db: Session,
    subscription_id: int,
    data: SerialIssueCreate,
    actor_id: Optional[int] = None
) -> SerialIssue:
    sub = db.query(SerialSubscription).filter(SerialSubscription.id == subscription_id).first()
    if not sub:
        raise ValueError(f"Serial Subscription ID {subscription_id} not found.")

    accession = data.accession_number or generate_accession_number(db)
    issue = SerialIssue(
        subscription_id=sub.id,
        volume=data.volume.strip(),
        issue_number=data.issue_number.strip(),
        publication_date=data.publication_date,
        received_date=datetime.now(timezone.utc).date(),
        status=data.status,
        accession_number=accession
    )
    db.add(issue)
    db.commit()
    db.refresh(issue)

    log_audit_event(
        db,
        action="SERIAL_ISSUE_RECEIVED",
        resource_type="serial_issue",
        resource_id=f"{sub.subscription_code}-V{issue.volume}-N{issue.issue_number}",
        actor_user_id=actor_id,
        details={"subscription": sub.title, "accession": accession}
    )
    db.commit()
    return issue
