from typing import Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.interop.ncip_adapter import NCIP2Adapter
from app.interop.sip2_adapter import SIP2Adapter

router = APIRouter(prefix="/interop", tags=["Interoperability (NCIP 2.0 & SIP2)"])

@router.post("/ncip")
def process_ncip_message(
    payload: Dict[str, Any] = Body(...),
    db: Session = Depends(get_db)
):
    """
    Mock NCIP 2.0 (NISO Z39.83) Message Endpoint (AC03, FR03).
    Supports LookupUser, CheckoutItem, CheckinItem, and RenewItem.
    """
    response = NCIP2Adapter.process_message(db, payload)
    return response

@router.post("/sip2")
def process_sip2_frame(
    payload: Dict[str, str] = Body(...),
    db: Session = Depends(get_db)
):
    """
    Mock 3M SIP2 Protocol Frame Endpoint (AC03, FR03).
    Parses incoming raw SIP2 packet, processes circulation rules, and generates standard response frame.
    """
    raw_frame = payload.get("raw_frame", "").strip()
    if not raw_frame:
        raise HTTPException(status_code=400, detail="raw_frame string is required")

    raw_response, parsed_data = SIP2Adapter.process_raw_message(db, raw_frame)
    checksum = SIP2Adapter.calculate_checksum(raw_response)

    return {
        "raw_response": raw_response,
        "checksum": checksum,
        "parsed": parsed_data
    }
