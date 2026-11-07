from datetime import datetime, timezone
from typing import Dict, Any, Tuple
from sqlalchemy.orm import Session
from app.services import circulation_service
from app.models.catalog import BookItem
from app.models.member import Member

class SIP2Adapter:
    """
    Documented Mock 3M SIP2 Protocol Adapter Boundary (AC03, FR03).
    Parses incoming SIP2 socket message frames and formats standard SIP2 responses.
    """

    @staticmethod
    def parse_fields(raw_msg: str) -> Dict[str, str]:
        """Parses variable-length fields delimited by '|'."""
        fields = {}
        parts = raw_msg.split("|")
        for part in parts:
            if len(part) >= 2:
                code = part[:2]
                val = part[2:]
                fields[code] = val
        return fields

    @staticmethod
    def calculate_checksum(msg: str) -> str:
        """Calculates 3M SIP2 4-character hex 2's complement checksum."""
        total = sum(ord(c) for c in msg)
        checksum = (-total) & 0xFFFF
        return f"{checksum:04X}"

    @staticmethod
    def process_raw_message(db: Session, raw_msg: str) -> Tuple[str, Dict[str, Any]]:
        """
        Parses raw SIP2 frame, routes to domain service, and returns SIP2 response frame.
        """
        if len(raw_msg) < 2:
            return "96", {"error": "Invalid SIP2 frame length"}

        command = raw_msg[:2]
        fields = SIP2Adapter.parse_fields(raw_msg)
        now_str = datetime.now(timezone.utc).strftime("%Y%m%d    %H%M%S")

        # -------------------------------------------------------------
        # Message 11: Checkout Request -> 12: Checkout Response
        # -------------------------------------------------------------
        if command == "11":
            patron_id = fields.get("AA", "")
            item_id = fields.get("AB", "")
            institution = fields.get("AO", "AISYS-LIB")

            member = circulation_service.resolve_member(db, membership_number=patron_id, smart_card_uid=patron_id)
            book_item = circulation_service.resolve_book_item(db, accession_number=item_id, barcode=item_id, tag_uid=item_id)

            if not member or not book_item:
                resp = f"120N0N{now_str}AO{institution}|AA{patron_id}|AB{item_id}|AFItem or Member Not Found|"
                return resp, {"command": "12", "ok": False, "reason": "Not Found"}

            try:
                tx = circulation_service.checkout_book(
                    db,
                    book_item=book_item,
                    member=member,
                    protocol="SIP2",
                    notes="3M SIP2 Mock Checkout"
                )
                due_date_str = tx.due_date.strftime("%Y%m%d    %H%M%S")
                title = book_item.book.title if book_item.book else "Unknown"
                # 12<ok=1><renewal_ok=N><magnetic_media=0><desensitize=Y>
                resp = f"121NYY{now_str}AO{institution}|AA{member.membership_number}|AB{book_item.accession_number}|AJ{title}|AH{due_date_str}|AFCheckout Successful. Due: {tx.due_date.strftime('%Y-%m-%d')}|"
                return resp, {
                    "command": "12",
                    "ok": True,
                    "accession": book_item.accession_number,
                    "member": member.membership_number,
                    "due_date": due_date_str,
                    "desensitize": True
                }
            except ValueError as e:
                resp = f"120NNN{now_str}AO{institution}|AA{member.membership_number}|AB{book_item.accession_number}|AF{str(e)}|"
                return resp, {"command": "12", "ok": False, "reason": str(e)}

        # -------------------------------------------------------------
        # Message 09: Checkin Request -> 10: Checkin Response
        # -------------------------------------------------------------
        elif command == "09":
            item_id = fields.get("AB", "")
            institution = fields.get("AO", "AISYS-LIB")
            book_item = circulation_service.resolve_book_item(db, accession_number=item_id, barcode=item_id, tag_uid=item_id)

            if not book_item:
                resp = f"100NNN{now_str}AO{institution}|AB{item_id}|AFItem Not Found|"
                return resp, {"command": "10", "ok": False, "reason": "Item Not Found"}

            try:
                tx = circulation_service.checkin_book(
                    db,
                    book_item=book_item,
                    protocol="SIP2",
                    notes="3M SIP2 Mock Checkin"
                )
                title = book_item.book.title if book_item.book else "Unknown"
                # 10<ok=1><resensitize=Y><magnetic_media=0><alert=N>
                resp = f"101YYN{now_str}AO{institution}|AB{book_item.accession_number}|AJ{title}|AQ{book_item.shelf_location}|AFReturn Successful. Resensitize tag.|"
                return resp, {
                    "command": "10",
                    "ok": True,
                    "accession": book_item.accession_number,
                    "shelf_location": book_item.shelf_location,
                    "fine_assessed": tx.fine_amount,
                    "resensitize": True
                }
            except ValueError as e:
                resp = f"100NNN{now_str}AO{institution}|AB{book_item.accession_number}|AF{str(e)}|"
                return resp, {"command": "10", "ok": False, "reason": str(e)}

        # -------------------------------------------------------------
        # Message 29: Renew Request -> 30: Renew Response
        # -------------------------------------------------------------
        elif command == "29":
            item_id = fields.get("AB", "")
            patron_id = fields.get("AA", "")
            institution = fields.get("AO", "AISYS-LIB")
            book_item = circulation_service.resolve_book_item(db, accession_number=item_id, barcode=item_id, tag_uid=item_id)

            if not book_item:
                resp = f"300NNN{now_str}AO{institution}|AA{patron_id}|AB{item_id}|AFItem Not Found|"
                return resp, {"command": "30", "ok": False, "reason": "Item Not Found"}

            try:
                tx = circulation_service.renew_book(db, book_item=book_item, protocol="SIP2")
                due_date_str = tx.due_date.strftime("%Y%m%d    %H%M%S")
                resp = f"301YYY{now_str}AO{institution}|AA{patron_id}|AB{book_item.accession_number}|AH{due_date_str}|AFRenewal Successful|"
                return resp, {"command": "30", "ok": True, "accession": book_item.accession_number, "new_due_date": due_date_str}
            except ValueError as e:
                resp = f"300NNN{now_str}AO{institution}|AA{patron_id}|AB{book_item.accession_number}|AF{str(e)}|"
                return resp, {"command": "30", "ok": False, "reason": str(e)}

        # -------------------------------------------------------------
        # Message 63: Patron Information -> 64: Patron Status Response
        # -------------------------------------------------------------
        elif command == "63":
            patron_id = fields.get("AA", "")
            institution = fields.get("AO", "AISYS-LIB")
            member = circulation_service.resolve_member(db, membership_number=patron_id, smart_card_uid=patron_id)

            if not member:
                resp = f"64              001{now_str}AO{institution}|AA{patron_id}|AFPatron Not Found|"
                return resp, {"command": "64", "ok": False}

            # 64<status flags 14 chars><lang 3 chars><time>
            is_blocked = "Y" if member.status == "blocked" else " "
            status_flags = f"{is_blocked}             "[:14]
            resp = f"64{status_flags}001{now_str}AO{institution}|AA{member.membership_number}|AE{member.full_name}|BV${member.fine_balance:.2f}|AFPatron active|"
            return resp, {"command": "64", "ok": True, "member": member.full_name, "status": member.status}

        else:
            return f"96{now_str}AFUnsupported Command {command}|", {"command": "96", "ok": False, "error": f"Unsupported command {command}"}
