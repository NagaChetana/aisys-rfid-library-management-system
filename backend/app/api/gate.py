from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.schemas.gate import GateEventOut, GatePassageRequest, GateStatsOut
from app.services import gate_service
from app.models.gate import GateEvent

router = APIRouter(prefix="/gate", tags=["RFID Security Gate & CCTV Surveillance"])

def map_gate_to_out(g: GateEvent) -> GateEventOut:
    return GateEventOut(
        id=g.id,
        reader_id=g.reader_id,
        tag_uid=g.tag_uid,
        book_item_id=g.book_item_id,
        accession_number=g.accession_number,
        book_title=g.book_item.book.title if g.book_item and g.book_item.book else "Unknown",
        event_type=g.event_type,
        eas_bit_state=g.eas_bit_state,
        alarm_triggered=g.alarm_triggered,
        cctv_image_url=g.cctv_image_url,
        timestamp=g.timestamp
    )

@router.post("/simulate-passage", response_model=List[GateEventOut], status_code=status.HTTP_201_CREATED)
def simulate_gate_passage(
    req: GatePassageRequest,
    db: Session = Depends(get_db)
):
    """
    Simulates physical movement of RFID-tagged items through the security gate pedestals (AC06, FR07).
    Dispatches alarms if an item with armed EAS bit (True) passes.
    """
    events = gate_service.simulate_passage(
        db,
        reader_id=req.reader_id,
        tag_uids=req.tag_uids,
        is_person_passing=req.is_person_passing
    )
    return [map_gate_to_out(e) for e in events]

@router.post("/record-footfall", response_model=dict)
def record_footfall(
    count: int = Query(1, ge=1, le=100),
    db: Session = Depends(get_db)
):
    """Records pedestrian footfall registered by optical gate counter beam."""
    total = gate_service.increment_footfall(db, count)
    return {"status": "ok", "recorded": count, "cumulative_footfall": total}

@router.get("/events", response_model=dict)
def get_gate_events(
    alarm_only: bool = Query(False),
    limit: int = Query(50, ge=1, le=100),
    skip: int = Query(0, ge=0),
    db: Session = Depends(get_db)
):
    """Retrieves paginated history of gate events and security alarms."""
    items, total = gate_service.list_gate_events(db, alarm_only=alarm_only, limit=limit, skip=skip)
    return {
        "items": [map_gate_to_out(e) for e in items],
        "total": total,
        "skip": skip,
        "limit": limit
    }

@router.get("/stats", response_model=GateStatsOut)
def get_gate_statistics(db: Session = Depends(get_db)):
    """Returns aggregated gate metrics (total passages, alarm incidents, footfall count)."""
    return gate_service.get_gate_stats(db)

@router.get("/cctv/{filename}")
def get_mock_cctv_frame(filename: str):
    """
    Renders dynamic mock CCTV frame SVG snapshot for incident inspection (FR07).
    """
    now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    svg_content = f"""<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">
      <defs>
        <radialGradient id="vignette" cx="50%" cy="50%" r="70%">
          <stop offset="0%" stop-color="#1e293b" />
          <stop offset="100%" stop-color="#020617" />
        </radialGradient>
      </defs>
      <rect width="640" height="360" fill="url(#vignette)" />
      <!-- Grid lines -->
      <line x1="0" y1="180" x2="640" y2="180" stroke="#334155" stroke-width="0.5" stroke-dasharray="4 4" />
      <line x1="320" y1="0" x2="320" y2="360" stroke="#334155" stroke-width="0.5" stroke-dasharray="4 4" />
      <!-- Pedestal Graphic -->
      <rect x="180" y="80" width="24" height="200" fill="#475569" rx="4" />
      <rect x="436" y="80" width="24" height="200" fill="#475569" rx="4" />
      <!-- Optical Beam Detection -->
      <line x1="204" y1="180" x2="436" y2="180" stroke="#ef4444" stroke-width="2" stroke-dasharray="6 3" />
      <!-- Target Bounding Box -->
      <rect x="270" y="120" width="100" height="120" fill="none" stroke="#ef4444" stroke-width="2" />
      <circle cx="320" cy="180" r="4" fill="#ef4444" />
      <!-- HUD Text -->
      <text x="20" y="30" fill="#10b981" font-family="monospace" font-size="12">CAM 04 - GATE NORTH PEDESTAL A/B</text>
      <text x="20" y="50" fill="#94a3b8" font-family="monospace" font-size="11">{now_str}</text>
      <rect x="20" y="315" width="260" height="28" fill="#7f1d1d" rx="4" />
      <text x="30" y="334" fill="#fecaca" font-family="monospace" font-weight="bold" font-size="12">&#9888; EAS VIOLATION DETECTED</text>
      <text x="440" y="340" fill="#64748b" font-family="monospace" font-size="10">REC: {filename[:22]}</text>
    </svg>"""
    return Response(content=svg_content, media_type="image/svg+xml")
