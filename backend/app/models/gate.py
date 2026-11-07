from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base

class GateEvent(Base):
    __tablename__ = "gate_events"

    id = Column(Integer, primary_key=True, index=True)
    reader_id = Column(String(50), nullable=False, default="GATE-PEDESTAL-01", index=True)
    tag_uid = Column(String(64), nullable=False, index=True)
    book_item_id = Column(Integer, ForeignKey("book_items.id", ondelete="SET NULL"), nullable=True)
    accession_number = Column(String(50), nullable=True, index=True)
    event_type = Column(String(50), nullable=False)  # unauthorized_removal, authorized_passage, unknown_tag
    eas_bit_state = Column(Boolean, nullable=False, default=True)  # True = Armed (Violation)
    alarm_triggered = Column(Boolean, nullable=False, default=False)
    cctv_image_url = Column(String(255), nullable=True)  # path/url to mock CCTV still
    notification_queued = Column(Boolean, default=False)
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)

    book_item = relationship("BookItem")
