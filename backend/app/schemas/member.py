from typing import Optional
from datetime import date, datetime
from pydantic import BaseModel, EmailStr, ConfigDict

class MemberBase(BaseModel):
    full_name: str
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    membership_type: str = "student"
    max_allowed_loans: int = 5
    expiry_date: Optional[date] = None

class MemberCreate(MemberBase):
    membership_number: Optional[str] = None
    smart_card_uid: Optional[str] = None

class MemberUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    membership_type: Optional[str] = None
    status: Optional[str] = None
    max_allowed_loans: Optional[int] = None
    expiry_date: Optional[date] = None

class MemberOut(MemberBase):
    id: int
    membership_number: str
    smart_card_uid: Optional[str] = None
    status: str
    fine_balance: float
    active_loans_count: int = 0
    migration_batch_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

class AssignCardRequest(BaseModel):
    smart_card_uid: str
