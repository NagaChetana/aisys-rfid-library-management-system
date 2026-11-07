from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, ConfigDict

class CheckoutRequest(BaseModel):
    member_id: Optional[int] = None
    membership_number: Optional[str] = None
    member_smart_card_uid: Optional[str] = None
    accession_number: Optional[str] = None
    barcode: Optional[str] = None
    tag_uid: Optional[str] = None
    due_days: Optional[int] = None
    protocol: str = "INTERNAL_UI"  # INTERNAL_UI, NCIP_2_0, SIP2

class CheckinRequest(BaseModel):
    accession_number: Optional[str] = None
    barcode: Optional[str] = None
    tag_uid: Optional[str] = None
    protocol: str = "INTERNAL_UI"

class RenewRequest(BaseModel):
    transaction_id: Optional[int] = None
    accession_number: Optional[str] = None
    tag_uid: Optional[str] = None
    additional_days: Optional[int] = None
    protocol: str = "INTERNAL_UI"

class DueDateEnquiryOut(BaseModel):
    accession_number: str
    book_title: str
    member_name: str
    membership_number: str
    checkout_date: datetime
    due_date: datetime
    renewal_count: int
    is_overdue: bool
    days_overdue: int
    estimated_fine: float

    model_config = ConfigDict(from_attributes=True)

class CirculationTransactionOut(BaseModel):
    id: int
    transaction_type: str
    book_item_id: int
    accession_number: str
    book_title: str
    member_id: int
    member_name: str
    membership_number: str
    operator_user_id: Optional[int] = None
    protocol: str
    checkout_date: datetime
    due_date: datetime
    return_date: Optional[datetime] = None
    renewal_count: int
    fine_amount: float
    notes: Optional[str] = None
    eas_bit: Optional[bool] = None  # Current EAS state
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class FineOut(BaseModel):
    id: int
    member_id: int
    member_name: str
    membership_number: str
    circulation_transaction_id: Optional[int] = None
    amount: float
    paid_amount: float
    status: str
    reason: str
    assessed_date: datetime
    settled_date: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)
