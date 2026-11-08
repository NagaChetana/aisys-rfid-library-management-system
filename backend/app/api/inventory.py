from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import get_current_user_optional
from app.schemas.inventory import (
    InventorySessionCreate, InventorySessionOut, InventorySessionDetail,
    BulkInventoryScanRequest, BulkInventoryScanResult
)
from app.services import inventory_service

router = APIRouter(prefix="/inventory", tags=["RFID Inventory & Stock Verification"])

@router.post("/sessions", response_model=InventorySessionOut, status_code=status.HTTP_201_CREATED)
def create_inventory_session(
    req: InventorySessionCreate,
    db: Session = Depends(get_db),
    user = Depends(get_current_user_optional)
):
    """Initializes a new stock verification inventory session for a target shelf (FR06)."""
    actor_id = user.id if user else None
    return inventory_service.create_session(
        db,
        session_name=req.session_name,
        target_shelf=req.target_shelf,
        operator_user_id=actor_id
    )

@router.get("/sessions", response_model=dict)
def list_inventory_sessions(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db)
):
    """Lists existing and past inventory verification sessions."""
    items, total = inventory_service.list_sessions(db, skip=skip, limit=limit)
    return {
        "items": [
            InventorySessionOut.model_validate(s) for s in items
        ],
        "total": total,
        "skip": skip,
        "limit": limit
    }

@router.get("/sessions/{session_id}", response_model=InventorySessionDetail)
def get_inventory_session(
    session_id: int,
    db: Session = Depends(get_db)
):
    """Retrieves full breakdown of inventory session: scanned, misplaced, and missing items."""
    try:
        return inventory_service.get_session_detail(db, session_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))

@router.post("/sessions/{session_id}/scan", response_model=BulkInventoryScanResult)
def scan_items(
    session_id: int,
    req: BulkInventoryScanRequest,
    db: Session = Depends(get_db)
):
    """Simulates handheld bulk RFID antenna sweeps over books on the shelf (AC05)."""
    try:
        return inventory_service.process_bulk_scans(
            db,
            session_id=session_id,
            tag_uids=req.tag_uids,
            detected_shelf=req.detected_shelf
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

@router.post("/sessions/{session_id}/complete", response_model=InventorySessionDetail)
def complete_inventory_session(
    session_id: int,
    db: Session = Depends(get_db)
):
    """Finalizes inventory session, marks missing items, and writes completion audit record."""
    try:
        return inventory_service.complete_session(db, session_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
