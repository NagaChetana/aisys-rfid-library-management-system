from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict

class InventorySessionCreate(BaseModel):
    session_name: str
    target_shelf: str

class InventoryScanItemOut(BaseModel):
    id: int
    tag_uid: str
    book_item_id: Optional[int] = None
    accession_number: Optional[str] = None
    book_title: Optional[str] = None
    detected_shelf: str
    expected_shelf: Optional[str] = None
    scan_status: str  # correct, misplaced, unknown_tag
    scanned_at: datetime

    model_config = ConfigDict(from_attributes=True)

class InventoryMissingItemOut(BaseModel):
    book_item_id: int
    accession_number: str
    barcode: str
    title: str
    expected_shelf: str
    tag_uid: Optional[str] = None

class InventorySessionOut(BaseModel):
    id: int
    session_name: str
    target_shelf: str
    operator_user_id: Optional[int] = None
    status: str
    total_expected: int
    total_scanned: int
    total_missing: int
    total_misplaced: int
    started_at: datetime
    completed_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

class InventorySessionDetail(InventorySessionOut):
    scans: List[InventoryScanItemOut] = []
    missing_items: List[InventoryMissingItemOut] = []

class BulkInventoryScanRequest(BaseModel):
    tag_uids: List[str]
    detected_shelf: Optional[str] = None  # defaults to target_shelf

class BulkInventoryScanResult(BaseModel):
    session_id: int
    scanned_count: int
    suppressed_duplicates: int
    correctly_located: int
    misplaced: int
    unknown_tags: int
    items: List[InventoryScanItemOut]
