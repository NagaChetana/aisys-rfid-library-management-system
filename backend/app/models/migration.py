from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base

class MigrationBatch(Base):
    __tablename__ = "migration_batches"

    id = Column(Integer, primary_key=True, index=True)
    batch_number = Column(String(50), unique=True, nullable=False, index=True)
    filename = Column(String(255), nullable=False)
    total_records = Column(Integer, default=0, nullable=False)
    valid_records = Column(Integer, default=0, nullable=False)
    invalid_records = Column(Integer, default=0, nullable=False)
    migrated_records = Column(Integer, default=0, nullable=False)
    status = Column(String(30), default="staged", nullable=False, index=True)  # staged, validated, migrated, rolled_back, failed
    error_log = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    migrated_at = Column(DateTime, nullable=True)

    staged_records = relationship("StagedRecord", back_populates="batch", cascade="all, delete-orphan")

class StagedRecord(Base):
    __tablename__ = "staged_records"

    id = Column(Integer, primary_key=True, index=True)
    migration_batch_id = Column(Integer, ForeignKey("migration_batches.id", ondelete="CASCADE"), nullable=False, index=True)
    row_number = Column(Integer, nullable=False)
    raw_data = Column(Text, nullable=False)  # JSON-encoded row representation
    is_valid = Column(Boolean, default=False, nullable=False)
    validation_errors = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    batch = relationship("MigrationBatch", back_populates="staged_records")
