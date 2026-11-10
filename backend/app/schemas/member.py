import re
from typing import Optional
from datetime import date, datetime
from pydantic import BaseModel, ConfigDict, field_validator

INDIAN_PHONE_REGEX = re.compile(r'^(\+91[\-\s]?|91[\-\s]?|0)?[6-9]\d{9}$')
INTL_PHONE_REGEX = re.compile(r'^\+[1-9]\d{7,14}$')
EMAIL_REGEX = re.compile(r'^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+(\.[a-zA-Z0-9-]+)*\.[a-zA-Z]{2,}$')

def _validate_email_value(v: Optional[str]) -> Optional[str]:
    if v is None:
        return None
    s = str(v).strip()
    if not s:
        return None
    if not EMAIL_REGEX.match(s):
        raise ValueError("Invalid email address format. Example: user@domain.com")
    return s

def _validate_phone_value(v: Optional[str]) -> Optional[str]:
    if v is None:
        return None
    s = str(v).strip()
    if not s:
        return None
    if any(c.isalpha() for c in s):
        raise ValueError("Phone number must not contain letters")
    clean = re.sub(r'[\s\-()]', '', s)
    if not clean.replace('+', '').isdigit():
        raise ValueError("Phone number contains invalid characters")

    # Check Indian number formats:
    # 1. Starts with +91 or 91
    # 2. 10 digits without +
    # 3. 11 digits starting with 0
    if s.startswith('+91') or s.startswith('91') or (len(clean) == 10 and not s.startswith('+')) or (len(clean) == 11 and clean.startswith('0')):
        if not INDIAN_PHONE_REGEX.match(s) and not INDIAN_PHONE_REGEX.match(clean):
            raise ValueError("Invalid phone number. Must be a valid 10-digit Indian mobile number (e.g. 9876543210 or +91 9876543210)")
        return s

    # Other international formats starting with +
    if s.startswith('+'):
        if not INTL_PHONE_REGEX.match(clean):
            raise ValueError("Invalid international phone number format")
        return s

    if not INDIAN_PHONE_REGEX.match(clean):
        raise ValueError("Invalid phone number. Must be a valid 10-digit Indian mobile number (e.g. 9876543210 or +91 9876543210)")
    return s

class MemberBase(BaseModel):
    full_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    membership_type: str = "student"
    max_allowed_loans: int = 5
    expiry_date: Optional[date] = None

class MemberCreate(MemberBase):
    membership_number: Optional[str] = None
    smart_card_uid: Optional[str] = None

    @field_validator('full_name')
    @classmethod
    def validate_name(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Full name is required")
        return v.strip()

    @field_validator('email', mode='before')
    @classmethod
    def validate_email(cls, v: Optional[str]) -> Optional[str]:
        return _validate_email_value(v)

    @field_validator('phone', mode='before')
    @classmethod
    def validate_phone(cls, v: Optional[str]) -> Optional[str]:
        return _validate_phone_value(v)

class MemberUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    membership_type: Optional[str] = None
    status: Optional[str] = None
    max_allowed_loans: Optional[int] = None
    expiry_date: Optional[date] = None

    @field_validator('full_name')
    @classmethod
    def validate_name(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and not v.strip():
            raise ValueError("Full name cannot be blank")
        return v.strip() if v is not None else None

    @field_validator('email', mode='before')
    @classmethod
    def validate_email(cls, v: Optional[str]) -> Optional[str]:
        return _validate_email_value(v)

    @field_validator('phone', mode='before')
    @classmethod
    def validate_phone(cls, v: Optional[str]) -> Optional[str]:
        return _validate_phone_value(v)

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
