from datetime import datetime, date
from typing import Optional, List
from pydantic import BaseModel, Field, EmailStr

# --- SUPPLIERS ---
class SupplierBase(BaseModel):
    name: str = Field(..., max_length=150)
    contact_person: Optional[str] = Field(None, max_length=100)
    email: Optional[str] = Field(None, max_length=120)
    phone: Optional[str] = Field(None, max_length=50)
    address: Optional[str] = None
    is_active: bool = True

class SupplierCreate(SupplierBase):
    pass

class SupplierOut(SupplierBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

# --- PURCHASE ORDER ITEMS ---
class PurchaseOrderItemBase(BaseModel):
    title: str = Field(..., max_length=255)
    author: Optional[str] = Field(None, max_length=150)
    isbn: Optional[str] = Field(None, max_length=32)
    quantity: int = Field(1, ge=1)
    unit_price: float = Field(0.0, ge=0.0)

class PurchaseOrderItemCreate(PurchaseOrderItemBase):
    pass

class PurchaseOrderItemOut(PurchaseOrderItemBase):
    id: int
    purchase_order_id: int
    received_quantity: int
    created_at: datetime

    class Config:
        from_attributes = True

# --- PURCHASE ORDERS ---
class PurchaseOrderCreate(BaseModel):
    supplier_id: int
    expected_delivery_date: Optional[date] = None
    notes: Optional[str] = None
    items: List[PurchaseOrderItemCreate]

class PurchaseOrderOut(BaseModel):
    id: int
    po_number: str
    supplier_id: int
    supplier_name: Optional[str] = None
    order_date: date
    expected_delivery_date: Optional[date] = None
    status: str
    total_cost: float
    notes: Optional[str] = None
    items: List[PurchaseOrderItemOut]
    created_at: datetime

    class Config:
        from_attributes = True

class ReceiveOrderItemRequest(BaseModel):
    item_id: int
    quantity_to_receive: int = Field(..., ge=1)
    shelf_location: str = "MAIN-SHELF-A"
    create_catalog_records: bool = True

# --- SERIAL SUBSCRIPTIONS ---
class SerialSubscriptionCreate(BaseModel):
    subscription_code: str
    title: str
    issn: Optional[str] = None
    supplier_id: Optional[int] = None
    frequency: str = "Monthly"
    start_date: date
    end_date: date
    annual_cost: float = 0.0
    shelf_location: str = "PERIODICALS-BAY-1"

class SerialIssueCreate(BaseModel):
    volume: str
    issue_number: str
    publication_date: date
    status: str = "received"
    accession_number: Optional[str] = None

class SerialIssueOut(BaseModel):
    id: int
    subscription_id: int
    volume: str
    issue_number: str
    publication_date: date
    received_date: Optional[date] = None
    status: str
    accession_number: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class SerialSubscriptionOut(BaseModel):
    id: int
    subscription_code: str
    title: str
    issn: Optional[str] = None
    supplier_id: Optional[int] = None
    supplier_name: Optional[str] = None
    frequency: str
    start_date: date
    end_date: date
    annual_cost: float
    status: str
    shelf_location: str
    issues: List[SerialIssueOut]
    created_at: datetime

    class Config:
        from_attributes = True
