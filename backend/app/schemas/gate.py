from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict

class GateEventOut(BaseModel):
    id: int
    reader_id: str
    tag_uid: str
    book_item_id: Optional[int] = None
    accession_number: Optional[str] = None
    book_title: Optional[str] = None
    event_type: str
    eas_bit_state: bool
    alarm_triggered: bool
    cctv_image_url: Optional[str] = None
    timestamp: datetime

    model_config = ConfigDict(from_attributes=True)

class GatePassageRequest(BaseModel):
    reader_id: str = "GATE-PEDESTAL-01"
    tag_uids: List[str]
    is_person_passing: bool = True

class GateStatsOut(BaseModel):
    total_events: int
    total_alarms: int
    total_authorized: int
    today_footfall: int
    gate_status: str

    model_config = ConfigDict(from_attributes=True)
