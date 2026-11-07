from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel, ConfigDict

class TagItemRequest(BaseModel):
    book_item_id: int
    tag_uid: Optional[str] = None  # If omitted, generates unique 24-char hex EPC
    eas_bit: bool = True           # True = Armed (default)

class TagMemberRequest(BaseModel):
    member_id: int
    tag_uid: str

class RetagRequest(BaseModel):
    book_item_id: int
    new_tag_uid: Optional[str] = None
    reason: str = "Damaged tag replacement"

class RfidTagOut(BaseModel):
    id: int
    tag_uid: str
    item_type: str
    book_item_id: Optional[int] = None
    accession_number: Optional[str] = None
    book_title: Optional[str] = None
    shelf_location: Optional[str] = None
    member_id: Optional[int] = None
    member_name: Optional[str] = None
    eas_bit: bool
    status: str
    last_scanned_at: Optional[datetime] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class RfidTagHistoryOut(BaseModel):
    id: int
    tag_uid: str
    item_type: str
    book_item_id: Optional[int] = None
    member_id: Optional[int] = None
    assigned_at: datetime
    deassigned_at: Optional[datetime] = None
    deassignment_reason: Optional[str] = None
    actor_user_id: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)

class StaffScanItem(BaseModel):
    tag_uid: str
    item_type: str
    accession_number: Optional[str] = None
    barcode: Optional[str] = None
    book_title: Optional[str] = None
    author: Optional[str] = None
    status: str
    eas_bit: bool
    is_reference_only: bool

class StaffScanResult(BaseModel):
    reader_id: str
    timestamp: datetime
    total_detected: int
    items: List[StaffScanItem]
    unknown_tags: List[str]
    suppressed_duplicates: int
