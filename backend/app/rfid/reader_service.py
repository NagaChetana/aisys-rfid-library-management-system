from datetime import datetime, timezone
from typing import List, Tuple, Dict, Any, Optional
from sqlalchemy.orm import Session
from app.models.rfid import RfidTag
from app.models.catalog import BookItem
from app.rfid.deduplication import deduplicator
from app.schemas.rfid import StaffScanItem, StaffScanResult
from app.services.event_broadcaster import broadcaster

class ReaderRegistry:
    """
    Central registry of connected and simulated RFID readers (FR03, FR05).
    Tracks active devices, firmware, IP/MAC, heartbeat status, and aggregate throughput.
    """
    def __init__(self):
        self._readers: Dict[str, Dict[str, Any]] = {
            "STAFF-PAD-01": {
                "reader_id": "STAFF-PAD-01",
                "reader_type": "staff_desktop",
                "label": "Circulation Desk Flatbed Pad",
                "ip_address": "192.168.1.101",
                "mac_address": "00:1B:44:11:3A:B7",
                "firmware_version": "v2.4.1",
                "status": "online",
                "last_heartbeat": datetime.now(timezone.utc).isoformat(),
                "total_scans": 142,
                "power_dbm": 27.0
            },
            "HANDHELD-READER-01": {
                "reader_id": "HANDHELD-READER-01",
                "reader_type": "handheld",
                "label": "Inventory Mobile Scanner",
                "ip_address": "192.168.1.105",
                "mac_address": "00:1B:44:88:9C:F1",
                "firmware_version": "v3.1.0",
                "status": "online",
                "last_heartbeat": datetime.now(timezone.utc).isoformat(),
                "total_scans": 480,
                "power_dbm": 30.0
            },
            "GATE-EAST-01": {
                "reader_id": "GATE-EAST-01",
                "reader_type": "security_gate",
                "label": "Main Entrance Dual Pedestal Gate",
                "ip_address": "192.168.1.110",
                "mac_address": "00:1B:44:66:D2:E3",
                "firmware_version": "v1.9.8",
                "status": "online",
                "last_heartbeat": datetime.now(timezone.utc).isoformat(),
                "total_scans": 1289,
                "power_dbm": 31.5
            },
            "SELF-CHECKOUT-01": {
                "reader_id": "SELF-CHECKOUT-01",
                "reader_type": "self_service",
                "label": "Patron Self-Service Station",
                "ip_address": "192.168.1.120",
                "mac_address": "00:1B:44:99:EE:12",
                "firmware_version": "v2.0.4",
                "status": "standby",
                "last_heartbeat": datetime.now(timezone.utc).isoformat(),
                "total_scans": 64,
                "power_dbm": 25.0
            }
        }

    def list_readers(self) -> List[Dict[str, Any]]:
        return list(self._readers.values())

    def get_reader(self, reader_id: str) -> Optional[Dict[str, Any]]:
        return self._readers.get(reader_id)

    def record_heartbeat(self, reader_id: str, status: str = "online", ip_address: Optional[str] = None) -> Dict[str, Any]:
        if reader_id not in self._readers:
            self._readers[reader_id] = {
                "reader_id": reader_id,
                "reader_type": "generic_reader",
                "label": f"Reader {reader_id}",
                "ip_address": ip_address or "192.168.1.200",
                "mac_address": "00:1B:44:00:00:00",
                "firmware_version": "v1.0.0",
                "status": status,
                "last_heartbeat": datetime.now(timezone.utc).isoformat(),
                "total_scans": 0,
                "power_dbm": 27.0
            }
        else:
            self._readers[reader_id]["status"] = status
            self._readers[reader_id]["last_heartbeat"] = datetime.now(timezone.utc).isoformat()
            if ip_address:
                self._readers[reader_id]["ip_address"] = ip_address
        return self._readers[reader_id]

    def increment_scans(self, reader_id: str, count: int = 1):
        if reader_id in self._readers:
            self._readers[reader_id]["total_scans"] += count

reader_registry = ReaderRegistry()

def simulate_staff_pad_scan(
    db: Session,
    tag_uids: List[str],
    reader_id: str = "STAFF-PAD-01",
    enforce_dedup: bool = True
) -> StaffScanResult:
    """
    Simulates multi-tag placement on a desktop staff station pad reader.
    Filters out duplicates scanned within the 3000ms sliding window and resolves metadata.
    """
    now = datetime.now(timezone.utc)
    items: List[StaffScanItem] = []
    unknown_tags: List[str] = []
    suppressed_count = 0

    reader_registry.record_heartbeat(reader_id, "online")

    for raw_uid in tag_uids:
        uid = raw_uid.strip().upper()
        
        # 1. Duplicate event suppression
        if enforce_dedup and deduplicator.is_duplicate(reader_id, uid):
            suppressed_count += 1
            continue

        # 2. Tag lookup
        tag = db.query(RfidTag).filter(RfidTag.tag_uid == uid, RfidTag.status == "active").first()
        if not tag or not tag.book_item_id:
            unknown_tags.append(uid)
            continue

        # 3. Item & Bibliographic lookup
        item: BookItem = tag.book_item
        tag.last_scanned_at = now

        items.append(
            StaffScanItem(
                tag_uid=tag.tag_uid,
                item_type=tag.item_type,
                accession_number=item.accession_number,
                barcode=item.barcode,
                book_title=item.book.title if item.book else "Unknown",
                author=item.book.author.name if item.book and item.book.author else "Unknown",
                status=item.status,
                eas_bit=tag.eas_bit,
                is_reference_only=item.is_reference_only
            )
        )

    db.commit()

    reader_registry.increment_scans(reader_id, len(items))

    result = StaffScanResult(
        reader_id=reader_id,
        timestamp=now,
        total_detected=len(items) + len(unknown_tags),
        items=items,
        unknown_tags=unknown_tags,
        suppressed_duplicates=suppressed_count
    )

    if items or unknown_tags:
        broadcaster.broadcast("rfid_staff_scan", {
            "reader_id": reader_id,
            "detected_count": len(items) + len(unknown_tags),
            "suppressed_duplicates": suppressed_count,
            "item_accessions": [it.accession_number for it in items]
        })

    return result
