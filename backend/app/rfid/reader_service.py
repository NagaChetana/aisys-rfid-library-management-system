from datetime import datetime, timezone
from typing import List, Tuple
from sqlalchemy.orm import Session
from app.models.rfid import RfidTag
from app.models.catalog import BookItem
from app.rfid.deduplication import deduplicator
from app.schemas.rfid import StaffScanItem, StaffScanResult
from app.services.event_broadcaster import broadcaster

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
