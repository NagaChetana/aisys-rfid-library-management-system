from abc import ABC, abstractmethod
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional

class BaseNotificationAdapter(ABC):
    """Abstract Base Class for provider-neutral messaging adapters (FR09, Module D)."""

    @abstractmethod
    def send(self, recipient: str, subject: Optional[str], body: str, metadata: Optional[Dict[str, Any]] = None) -> bool:
        """Dispatches notification message. Returns True if successfully sent."""
        pass

class MockEmailAdapter(BaseNotificationAdapter):
    """
    Offline Provider-Neutral Mock Email Adapter (FR09, NFR06).
    Simulates enterprise SMTP/SES/SendGrid transmission with template rendering,
    delivery tracking, and error logging without requiring external network access.
    """
    def __init__(self):
        self._sent_mail: List[Dict[str, Any]] = []
        self._simulate_failure: bool = False

    def set_simulate_failure(self, fail: bool):
        self._simulate_failure = fail

    def send(self, recipient: str, subject: Optional[str], body: str, metadata: Optional[Dict[str, Any]] = None) -> bool:
        if self._simulate_failure:
            raise ConnectionError("Mock Email Gateway: Simulated SMTP host connection timeout.")

        record = {
            "channel": "email",
            "recipient": recipient,
            "subject": subject or "Library Notification",
            "body": body,
            "metadata": metadata or {},
            "sent_at": datetime.now(timezone.utc).isoformat(),
            "status": "delivered"
        }
        self._sent_mail.append(record)
        return True

    def get_sent_mail(self) -> List[Dict[str, Any]]:
        return list(self._sent_mail)

    def clear(self):
        self._sent_mail.clear()

class MockSmsAdapter(BaseNotificationAdapter):
    """Offline Provider-Neutral Mock SMS Gateway (FR09)."""
    def __init__(self):
        self._sent_sms: List[Dict[str, Any]] = []

    def send(self, recipient: str, subject: Optional[str], body: str, metadata: Optional[Dict[str, Any]] = None) -> bool:
        record = {
            "channel": "sms",
            "recipient": recipient,
            "body": body[:160],  # standard SMS truncation
            "sent_at": datetime.now(timezone.utc).isoformat(),
            "status": "delivered"
        }
        self._sent_sms.append(record)
        return True

class MockPrintAdapter(BaseNotificationAdapter):
    """
    Offline Provider-Neutral Mock Receipt & Slip Printer Adapter (FR09, Module C).
    Formats thermal print job slips with standard ESC/POS layout emulation.
    """
    def __init__(self):
        self._print_jobs: List[Dict[str, Any]] = []

    def send(self, recipient: str, subject: Optional[str], body: str, metadata: Optional[Dict[str, Any]] = None) -> bool:
        doc_type = subject or "Circulation Receipt"
        slip_text = (
            f"========================================\n"
            f"       AISYS INTELLIGENT LIBRARY        \n"
            f"       {doc_type.upper()}               \n"
            f"========================================\n"
            f"Recipient: {recipient}\n"
            f"Date: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}\n"
            f"----------------------------------------\n"
            f"{body}\n"
            f"========================================\n"
            f"  Thank you for using AISYS Library!    \n"
            f"========================================\n"
        )
        record = {
            "channel": "print",
            "recipient": recipient,
            "document_type": doc_type,
            "slip_text": slip_text,
            "metadata": metadata or {},
            "printed_at": datetime.now(timezone.utc).isoformat(),
            "status": "printed"
        }
        self._print_jobs.append(record)
        return True

    def get_print_jobs(self) -> List[Dict[str, Any]]:
        return list(self._print_jobs)

    def clear(self):
        self._print_jobs.clear()

# Default active adapters
default_email_adapter = MockEmailAdapter()
default_sms_adapter = MockSmsAdapter()
default_print_adapter = MockPrintAdapter()
