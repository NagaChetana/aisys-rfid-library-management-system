from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.core.database import Base

class RfidTag(Base):
    __tablename__ = "rfid_tags"

    id = Column(Integer, primary_key=True, index=True)
    tag_uid = Column(String(64), unique=True, nullable=False, index=True)  # 24-character hex EPC / ISO 15693 UID
    item_type = Column(String(30), nullable=False, default="book_item")  # book_item, member_card
    book_item_id = Column(Integer, ForeignKey("book_items.id", ondelete="SET NULL"), nullable=True, unique=True, index=True)
    member_id = Column(Integer, ForeignKey("members.id", ondelete="SET NULL"), nullable=True, unique=True, index=True)
    eas_bit = Column(Boolean, default=True, nullable=False)  # True = Armed (unauthorized removal triggers alarm); False = Disarmed (checked out)
    status = Column(String(30), default="active", nullable=False)  # active, decommissioned, damaged
    last_scanned_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    book_item = relationship("BookItem", back_populates="rfid_tag")
    member = relationship("Member", back_populates="rfid_tag")

class RfidTagHistory(Base):
    __tablename__ = "rfid_tag_history"

    id = Column(Integer, primary_key=True, index=True)
    tag_uid = Column(String(64), nullable=False, index=True)
    item_type = Column(String(30), nullable=False)  # book_item, member_card
    book_item_id = Column(Integer, ForeignKey("book_items.id", ondelete="SET NULL"), nullable=True, index=True)
    member_id = Column(Integer, ForeignKey("members.id", ondelete="SET NULL"), nullable=True, index=True)
    assigned_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    deassigned_at = Column(DateTime, nullable=True)
    deassignment_reason = Column(String(255), nullable=True)  # retagging, damaged, re-encoded
    actor_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
