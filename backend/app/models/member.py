from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Date
from sqlalchemy.orm import relationship
from app.core.database import Base

class Member(Base):
    __tablename__ = "members"

    id = Column(Integer, primary_key=True, index=True)
    membership_number = Column(String(50), unique=True, nullable=False, index=True)
    full_name = Column(String(100), nullable=False, index=True)
    email = Column(String(100), nullable=True)
    phone = Column(String(50), nullable=True)
    smart_card_uid = Column(String(64), unique=True, nullable=True, index=True)
    status = Column(String(30), default="active", nullable=False, index=True)  # active, suspended, blocked
    fine_balance = Column(Float, default=0.0, nullable=False)
    max_allowed_loans = Column(Integer, default=5, nullable=False)
    membership_type = Column(String(50), default="student", nullable=False)  # student, faculty, researcher, guest
    expiry_date = Column(Date, nullable=True)
    migration_batch_id = Column(Integer, ForeignKey("migration_batches.id", ondelete="SET NULL"), nullable=True, index=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    rfid_tag = relationship("RfidTag", back_populates="member", uselist=False)
    migration_batch = relationship("MigrationBatch", foreign_keys=[migration_batch_id])
