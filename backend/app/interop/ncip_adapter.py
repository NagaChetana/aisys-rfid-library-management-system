from datetime import datetime, timezone
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session
from app.services import circulation_service
from app.models.catalog import BookItem
from app.models.member import Member

class NCIP2Adapter:
    """
    Documented Mock NCIP 2.0 (NISO Z39.83) Protocol Adapter Boundary.
    Provides standard-style XML and JSON message envelopes for external ILMS integration.
    """

    @staticmethod
    def process_message(db: Session, message_data: Dict[str, Any]) -> Dict[str, Any]:
        action = message_data.get("action")
        timestamp = datetime.now(timezone.utc).isoformat()

        if action == "LookupUser":
            return NCIP2Adapter._lookup_user(db, message_data, timestamp)
        elif action == "CheckoutItem":
            return NCIP2Adapter._checkout_item(db, message_data, timestamp)
        elif action == "CheckinItem":
            return NCIP2Adapter._checkin_item(db, message_data, timestamp)
        elif action == "RenewItem":
            return NCIP2Adapter._renew_item(db, message_data, timestamp)
        else:
            return {
                "NCIPMessage": {
                    "Problem": {
                        "ProblemType": "Unsupported Service",
                        "ProblemDetail": f"The requested NCIP service '{action}' is not supported.",
                    },
                    "Timestamp": timestamp,
                }
            }

    @staticmethod
    def _lookup_user(db: Session, data: Dict[str, Any], timestamp: str) -> Dict[str, Any]:
        user_id = data.get("UserId")
        member = circulation_service.resolve_member(db, membership_number=user_id, smart_card_uid=user_id)
        if not member:
            return {
                "NCIPMessage": {
                    "LookupUserResponse": {
                        "Problem": {"ProblemType": "Unknown User", "ProblemDetail": f"User '{user_id}' not found."},
                        "Timestamp": timestamp,
                    }
                }
            }

        return {
            "NCIPMessage": {
                "LookupUserResponse": {
                    "UserId": member.membership_number,
                    "UserOptionalFields": {
                        "NameInformation": {"PersonalNameInformation": {"FullName": member.full_name}},
                        "UserAddressInformation": {"ElectronicAddress": member.email},
                        "UserPrivilege": {"UserPrivilegeStatus": member.status},
                        "AccountDetails": {"FiscalTransactionInformation": {"Amount": member.fine_balance}},
                    },
                    "Timestamp": timestamp,
                }
            }
        }

    @staticmethod
    def _checkout_item(db: Session, data: Dict[str, Any], timestamp: str) -> Dict[str, Any]:
        user_id = data.get("UserId")
        item_id = data.get("ItemId")

        member = circulation_service.resolve_member(db, membership_number=user_id, smart_card_uid=user_id)
        if not member:
            return {
                "NCIPMessage": {
                    "CheckoutItemResponse": {
                        "Problem": {"ProblemType": "Unknown User", "ProblemDetail": f"Patron '{user_id}' not found."},
                        "Timestamp": timestamp,
                    }
                }
            }

        book_item = circulation_service.resolve_book_item(db, accession_number=item_id, barcode=item_id, tag_uid=item_id)
        if not book_item:
            return {
                "NCIPMessage": {
                    "CheckoutItemResponse": {
                        "Problem": {"ProblemType": "Unknown Item", "ProblemDetail": f"Item '{item_id}' not found."},
                        "Timestamp": timestamp,
                    }
                }
            }

        try:
            tx = circulation_service.checkout_book(
                db,
                book_item=book_item,
                member=member,
                protocol="NCIP_2_0",
                notes="NCIP 2.0 Mock Checkout Transaction"
            )
            return {
                "NCIPMessage": {
                    "CheckoutItemResponse": {
                        "ItemId": book_item.accession_number,
                        "UserId": member.membership_number,
                        "DateDue": tx.due_date.isoformat(),
                        "Title": book_item.book.title if book_item.book else "Unknown",
                        "Desensitize": "True",  # Signals to RFID hardware: EAS Disarmed
                        "Timestamp": timestamp,
                    }
                }
            }
        except ValueError as e:
            return {
                "NCIPMessage": {
                    "CheckoutItemResponse": {
                        "Problem": {"ProblemType": "Circulation Restriction Block", "ProblemDetail": str(e)},
                        "Timestamp": timestamp,
                    }
                }
            }

    @staticmethod
    def _checkin_item(db: Session, data: Dict[str, Any], timestamp: str) -> Dict[str, Any]:
        item_id = data.get("ItemId")
        book_item = circulation_service.resolve_book_item(db, accession_number=item_id, barcode=item_id, tag_uid=item_id)
        if not book_item:
            return {
                "NCIPMessage": {
                    "CheckinItemResponse": {
                        "Problem": {"ProblemType": "Unknown Item", "ProblemDetail": f"Item '{item_id}' not found."},
                        "Timestamp": timestamp,
                    }
                }
            }

        try:
            tx = circulation_service.checkin_book(
                db,
                book_item=book_item,
                protocol="NCIP_2_0",
                notes="NCIP 2.0 Mock Checkin Transaction"
            )
            return {
                "NCIPMessage": {
                    "CheckinItemResponse": {
                        "ItemId": book_item.accession_number,
                        "RoutingInformation": {"Destination": book_item.shelf_location},
                        "Resensitize": "True",  # Signals to RFID hardware: EAS Armed
                        "FineAssessed": tx.fine_amount,
                        "Timestamp": timestamp,
                    }
                }
            }
        except ValueError as e:
            return {
                "NCIPMessage": {
                    "CheckinItemResponse": {
                        "Problem": {"ProblemType": "Checkin Failed", "ProblemDetail": str(e)},
                        "Timestamp": timestamp,
                    }
                }
            }

    @staticmethod
    def _renew_item(db: Session, data: Dict[str, Any], timestamp: str) -> Dict[str, Any]:
        item_id = data.get("ItemId")
        book_item = circulation_service.resolve_book_item(db, accession_number=item_id, barcode=item_id, tag_uid=item_id)
        if not book_item:
            return {
                "NCIPMessage": {
                    "RenewItemResponse": {
                        "Problem": {"ProblemType": "Unknown Item", "ProblemDetail": f"Item '{item_id}' not found."},
                        "Timestamp": timestamp,
                    }
                }
            }

        try:
            tx = circulation_service.renew_book(
                db,
                book_item=book_item,
                protocol="NCIP_2_0"
            )
            return {
                "NCIPMessage": {
                    "RenewItemResponse": {
                        "ItemId": book_item.accession_number,
                        "DateDue": tx.due_date.isoformat(),
                        "RenewalCount": tx.renewal_count,
                        "Timestamp": timestamp,
                    }
                }
            }
        except ValueError as e:
            return {
                "NCIPMessage": {
                    "RenewItemResponse": {
                        "Problem": {"ProblemType": "Renewal Blocked", "ProblemDetail": str(e)},
                        "Timestamp": timestamp,
                    }
                }
            }
