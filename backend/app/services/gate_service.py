import uuid
from datetime import datetime, timezone
from typing import List, Optional, Tuple, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import desc, func
from app.models.gate import GateEvent
from app.models.rfid import RfidTag
from app.models.catalog import BookItem
from app.models.setting import SystemSetting
from app.services.audit_service import log_audit_event
from app.services.event_broadcaster import broadcaster
from app.services import notification_service

def increment_footfall(db: Session, count: int = 1) -> int:
    setting = db.query(SystemSetting).filter(SystemSetting.key == "gate_footfall_count").first()
    if not setting:
        setting = SystemSetting(
            key="gate_footfall_count",
            value=str(count),
            description="Cumulative pedestrian footfall count registered by security gate optical beam"
        )
        db.add(setting)
        val = count
    else:
        try:
            val = int(setting.value) + count
        except ValueError:
            val = count
        setting.value = str(val)
    db.commit()
    return val

def get_footfall(db: Session) -> int:
    setting = db.query(SystemSetting).filter(SystemSetting.key == "gate_footfall_count").first()
    if setting:
        try:
            return int(setting.value)
        except ValueError:
            return 0
    return 0

def process_gate_tag(
    db: Session,
    tag_uid: str,
    reader_id: str = "GATE-PEDESTAL-01"
) -> GateEvent:
    """
    Evaluates an RFID tag detected between security gate pedestals (AC06, FR07).
    Inspects EAS security bit:
    - EAS = True (Armed/Active) -> Unauthorized book removal -> Alarm triggered + CCTV link + Email alert
    - EAS = False (Disarmed/Issued) -> Authorized passage -> No alarm
    - Unknown tag -> Unregistered tag passage
    """
    clean_uid = tag_uid.strip().upper()
    now = datetime.now(timezone.utc)

    # 1. Look up tag and associated book copy
    tag = db.query(RfidTag).filter(RfidTag.tag_uid == clean_uid).first()
    book_item: Optional[BookItem] = tag.book_item if tag and tag.book_item else None

    # Check circulation and EAS status
    if not tag:
        event_type = "unknown_tag"
        eas_bit = True
        alarm = False
        accession = None
        book_title = "Unknown Tag"
    elif not book_item:
        event_type = "unlinked_tag"
        eas_bit = tag.eas_bit
        alarm = tag.eas_bit
        accession = None
        book_title = "Unassigned Tag"
    else:
        accession = book_item.accession_number
        book_title = book_item.book.title if book_item.book else "Unknown Book"
        eas_bit = tag.eas_bit

        # If EAS bit is True, item was NOT properly checked out -> ALARM
        if eas_bit or book_item.status != "checked_out":
            event_type = "unauthorized_removal"
            alarm = True
        else:
            event_type = "authorized_passage"
            alarm = False

    # Mock CCTV frame identifier
    cctv_frame_id = f"cctv_{now.strftime('%Y%m%d_%H%M%S')}_{clean_uid[:8]}.svg"
    cctv_url = f"/api/gate/cctv/{cctv_frame_id}" if alarm else None

    # 2. Persist Gate Event Record
    gate_event = GateEvent(
        reader_id=reader_id,
        tag_uid=clean_uid,
        book_item_id=book_item.id if book_item else None,
        accession_number=accession,
        event_type=event_type,
        eas_bit_state=eas_bit,
        alarm_triggered=alarm,
        cctv_image_url=cctv_url,
        notification_queued=alarm,
        timestamp=now
    )
    db.add(gate_event)
    db.commit()
    db.refresh(gate_event)

    # 3. If alarm triggered: dispatch automated email notification & audit log
    if alarm:
        try:
            notification_service.send_gate_alarm_email(
                db,
                reader_id=reader_id,
                accession_number=accession,
                tag_uid=clean_uid,
                book_title=book_title,
                cctv_image_url=cctv_url
            )
        except Exception:
            pass

        log_audit_event(
            db,
            action="SECURITY_GATE_ALARM",
            resource_type="gate_event",
            resource_id=str(gate_event.id),
            details={
                "reader_id": reader_id,
                "accession": accession,
                "tag_uid": clean_uid,
                "eas_state": "ARMED_VIOLATION",
                "cctv": cctv_url
            }
        )

    # 4. Broadcast real-time SSE event
    broadcaster.broadcast(
        "gate_alarm" if alarm else "gate_passage",
        {
            "id": gate_event.id,
            "reader_id": reader_id,
            "tag_uid": clean_uid,
            "accession_number": accession,
            "book_title": book_title,
            "alarm_triggered": alarm,
            "event_type": event_type,
            "eas_bit_state": eas_bit,
            "cctv_image_url": cctv_url,
            "timestamp": now.isoformat()
        }
    )

    return gate_event

def simulate_passage(
    db: Session,
    reader_id: str,
    tag_uids: List[str],
    is_person_passing: bool = True
) -> List[GateEvent]:
    """Processes one or more tags simultaneously through the gate beam and updates footfall."""
    if is_person_passing:
        increment_footfall(db, 1)

    events: List[GateEvent] = []
    for uid in tag_uids:
        evt = process_gate_tag(db, uid, reader_id)
        events.append(evt)

    return events

def get_gate_stats(db: Session) -> Dict[str, Any]:
    total_events = db.query(GateEvent).count()
    total_alarms = db.query(GateEvent).filter(GateEvent.alarm_triggered.is_(True)).count()
    total_authorized = db.query(GateEvent).filter(GateEvent.event_type == "authorized_passage").count()
    today_footfall = get_footfall(db)

    return {
        "total_events": total_events,
        "total_alarms": total_alarms,
        "total_authorized": total_authorized,
        "today_footfall": today_footfall,
        "gate_status": "ONLINE_ARMED"
    }

def list_gate_events(
    db: Session,
    alarm_only: bool = False,
    limit: int = 50,
    skip: int = 0
) -> Tuple[List[GateEvent], int]:
    query = db.query(GateEvent)
    if alarm_only:
        query = query.filter(GateEvent.alarm_triggered.is_(True))
    total = query.count()
    items = query.order_by(desc(GateEvent.timestamp)).offset(skip).limit(limit).all()
    return items, total
