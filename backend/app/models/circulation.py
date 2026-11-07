from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.core.database import Base

class CirculationTransaction(Base):
    __tablename__ = "circulation_transactions"

    id = Column(Integer, primary_key=True, index=True)
    transaction_type = Column(String(30), nullable=False, index=True)  # checkout, checkin, renewal
    book_item_id = Column(Integer, ForeignKey("book_items.id"), nullable=False, index=True)
    member_id = Column(Integer, ForeignKey("members.id"), nullable=False, index=True)
    operator_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    protocol = Column(String(30), default="INTERNAL_UI", nullable=False)  # INTERNAL_UI, NCIP_2_0, SIP2
    checkout_date = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    due_date = Column(DateTime, nullable=False, index=True)
    return_date = Column(DateTime, nullable=True)
    renewal_count = Column(Integer, default=0, nullable=False)
    fine_amount = Column(Float, default=0.0, nullable=False)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    book_item = relationship("BookItem")
    member = relationship("Member")
    operator = relationship("User")
    fines = relationship("Fine", back_populates="transaction")

class Fine(Base):
    __tablename__ = "fines"

    id = Column(Integer, primary_key=True, index=True)
    member_id = Column(Integer, ForeignKey("members.id"), nullable=False, index=True)
    circulation_transaction_id = Column(Integer, ForeignKey("circulation_transactions.id"), nullable=True)
    amount = Column(Float, nullable=False)
    paid_amount = Column(Float, default=0.0, nullable=False)
    status = Column(String(30), default="unpaid", nullable=False, index=True)  # unpaid, partially_paid, paid, waived
    reason = Column(String(255), nullable=False)  # Overdue fine, Damaged book, Lost book
    assessed_date = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    settled_date = Column(DateTime, nullable=True)

    member = relationship("Member")
    transaction = relationship("CirculationTransaction", back_populates="fines")
