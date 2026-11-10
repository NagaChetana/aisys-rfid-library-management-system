from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import get_current_user_optional, require_role
from app.schemas.acquisition import (
    SupplierCreate, SupplierOut,
    PurchaseOrderCreate, PurchaseOrderOut, PurchaseOrderItemOut,
    ReceiveOrderItemRequest,
    SerialSubscriptionCreate, SerialSubscriptionOut,
    SerialIssueCreate, SerialIssueOut
)
from app.services import acquisition_service

router = APIRouter(prefix="/acquisitions", tags=["Acquisitions & Serials"])

def map_po_to_out(po) -> PurchaseOrderOut:
    return PurchaseOrderOut(
        id=po.id,
        po_number=po.po_number,
        supplier_id=po.supplier_id,
        supplier_name=po.supplier.name if po.supplier else None,
        order_date=po.order_date,
        expected_delivery_date=po.expected_delivery_date,
        status=po.status,
        total_cost=po.total_cost,
        notes=po.notes,
        created_at=po.created_at,
        items=[
            PurchaseOrderItemOut(
                id=item.id,
                purchase_order_id=item.purchase_order_id,
                title=item.title,
                author=item.author,
                isbn=item.isbn,
                quantity=item.quantity,
                unit_price=item.unit_price,
                received_quantity=item.received_quantity,
                created_at=item.created_at
            )
            for item in po.items
        ]
    )

def map_sub_to_out(sub) -> SerialSubscriptionOut:
    return SerialSubscriptionOut(
        id=sub.id,
        subscription_code=sub.subscription_code,
        title=sub.title,
        issn=sub.issn,
        supplier_id=sub.supplier_id,
        supplier_name=sub.supplier.name if sub.supplier else None,
        frequency=sub.frequency,
        start_date=sub.start_date,
        end_date=sub.end_date,
        annual_cost=sub.annual_cost,
        status=sub.status,
        shelf_location=sub.shelf_location,
        created_at=sub.created_at,
        issues=[
            SerialIssueOut(
                id=i.id,
                subscription_id=i.subscription_id,
                volume=i.volume,
                issue_number=i.issue_number,
                publication_date=i.publication_date,
                received_date=i.received_date,
                status=i.status,
                accession_number=i.accession_number,
                created_at=i.created_at
            )
            for i in sub.issues
        ]
    )

# --- SUPPLIERS ---

@router.get("/suppliers", response_model=List[SupplierOut])
def get_suppliers(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=200),
    db: Session = Depends(get_db)
):
    return acquisition_service.list_suppliers(db, skip=skip, limit=limit)

@router.post("/suppliers", response_model=SupplierOut, status_code=status.HTTP_201_CREATED)
def create_supplier(
    req: SupplierCreate,
    db: Session = Depends(get_db),
    user = Depends(require_role(["ADMIN", "LIBRARIAN"]))
):
    actor_id = user.id if user else None
    try:
        return acquisition_service.create_supplier(db, req, actor_id=actor_id)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

# --- PURCHASE ORDERS ---

@router.get("/orders", response_model=List[PurchaseOrderOut])
def get_purchase_orders(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db)
):
    pos = acquisition_service.list_purchase_orders(db, skip=skip, limit=limit)
    return [map_po_to_out(p) for p in pos]

@router.post("/orders", response_model=PurchaseOrderOut, status_code=status.HTTP_201_CREATED)
def create_purchase_order(
    req: PurchaseOrderCreate,
    db: Session = Depends(get_db),
    user = Depends(require_role(["ADMIN", "LIBRARIAN"]))
):
    actor_id = user.id if user else None
    try:
        po = acquisition_service.create_purchase_order(db, req, actor_id=actor_id)
        return map_po_to_out(po)
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))

@router.post("/orders/{order_id}/receive")
def receive_order_item(
    order_id: int,
    req: ReceiveOrderItemRequest,
    db: Session = Depends(get_db),
    user = Depends(require_role(["ADMIN", "LIBRARIAN"]))
):
    actor_id = user.id if user else None
    try:
        po, accessions = acquisition_service.receive_purchase_order_item(
            db, po_id=order_id, req=req, actor_id=actor_id
        )
        return {
            "message": f"Successfully received {req.quantity_to_receive} items.",
            "po": map_po_to_out(po),
            "created_accessions": accessions
        }
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))

# --- SERIALS & PERIODICALS ---

@router.get("/serials", response_model=List[SerialSubscriptionOut])
def get_serial_subscriptions(db: Session = Depends(get_db)):
    subs = acquisition_service.list_serial_subscriptions(db)
    return [map_sub_to_out(s) for s in subs]

@router.post("/serials", response_model=SerialSubscriptionOut, status_code=status.HTTP_201_CREATED)
def create_serial_subscription(
    req: SerialSubscriptionCreate,
    db: Session = Depends(get_db),
    user = Depends(require_role(["ADMIN", "LIBRARIAN"]))
):
    actor_id = user.id if user else None
    try:
        sub = acquisition_service.create_serial_subscription(db, req, actor_id=actor_id)
        return map_sub_to_out(sub)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

@router.post("/serials/{subscription_id}/issues", response_model=SerialIssueOut, status_code=status.HTTP_201_CREATED)
def receive_serial_issue(
    subscription_id: int,
    req: SerialIssueCreate,
    db: Session = Depends(get_db),
    user = Depends(require_role(["ADMIN", "LIBRARIAN"]))
):
    actor_id = user.id if user else None
    try:
        return acquisition_service.receive_serial_issue(db, subscription_id=subscription_id, data=req, actor_id=actor_id)
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
