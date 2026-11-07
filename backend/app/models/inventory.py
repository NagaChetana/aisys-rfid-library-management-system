from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base

class InventorySession(Base):
    __tablename__ = "inventory_sessions"

    id = Column(Integer, primary_key=True, index=True)
    session_name = Column(String(100), nullable=False)
    target_shelf = Column(String(50), nullable=False, index=True)
    operator_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    status = Column(String(30), default="in_progress", nullable=False)  # in_progress, completed, cancelled
    total_expected = Column(Integer, default=0)
    total_scanned = Column(Integer, default=0)
    total_missing = Column(Integer, default=0)
    total_misplaced = Column(Integer, default=0)
    started_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    completed_at = Column(DateTime, nullable=True)

    operator = relationship("User")
    scans = relationship("InventoryScan", back_populates="session", cascade="all, delete-orphan")

class InventoryScan(Base):
    __tablename__ = "inventory_scans"

    id = Column(Integer, primary_key=True, index=True)
    inventory_session_id = Column(Integer, ForeignKey("inventory_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    tag_uid = Column(String(64), nullable=False, index=True)
    book_item_id = Column(Integer, ForeignKey("book_items.id"), nullable=True)
    detected_shelf = Column(String(50), nullable=False)
    expected_shelf = Column(String(50), nullable=True)
    scan_status = Column(String(30), nullable=False)  # correct, misplaced, unknown_tag
    scanned_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    session = relationship("InventorySession", back_populates="scans")
    book_item = relationship("BookItem")
