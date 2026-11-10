from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional

class BaseRfidReaderAdapter(ABC):
    """
    Device-neutral RFID Reader hardware interface contract (FR03, FR05, Module C).
    Enforces unified command structure across vendors (Feig, Impinj, Nordic ID, Simulated).
    """

    @abstractmethod
    def read_tags(self, reader_id: str, timeout_ms: int = 500) -> List[Dict[str, Any]]:
        """Scans all tags currently present within the RF field."""
        pass

    @abstractmethod
    def write_tag_uid(self, reader_id: str, old_uid: str, new_uid: str) -> bool:
        """Programs or rewrites the EPC memory bank of a tag."""
        pass

    @abstractmethod
    def set_eas_bit(self, reader_id: str, tag_uid: str, state: bool) -> bool:
        """Sets or resets the Electronic Article Surveillance (EAS) security bit."""
        pass

    @abstractmethod
    def get_hardware_status(self, reader_id: str) -> Dict[str, Any]:
        """Queries reader health, antenna VSWR, power levels, and firmware."""
        pass

class MockVirtualReaderAdapter(BaseRfidReaderAdapter):
    """
    Standard Virtual Reader Adapter implementation for testing and development.
    """
    def __init__(self, reader_id: str = "STAFF-PAD-01"):
        self.reader_id = reader_id
        self._connected = True

    def read_tags(self, reader_id: str, timeout_ms: int = 500) -> List[Dict[str, Any]]:
        return []

    def write_tag_uid(self, reader_id: str, old_uid: str, new_uid: str) -> bool:
        return True

    def set_eas_bit(self, reader_id: str, tag_uid: str, state: bool) -> bool:
        return True

    def get_hardware_status(self, reader_id: str) -> Dict[str, Any]:
        return {
            "reader_id": reader_id,
            "connected": self._connected,
            "power_level_dbm": 27.0,
            "frequency_mhz": 865.7,  # European / Indian RFID band (ISO 18000-6C)
            "antenna_status": "ok",
            "vswr": 1.15
        }
