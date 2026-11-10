from datetime import datetime, timezone, date
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Date, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.core.database import Base

class Supplier(Base):
    """Supplier / Vendor record for library acquisitions (FR01)."""
    __tablename__ = "suppliers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(150), nullable=False, unique=True, index=True)
    contact_person = Column(String(100), nullable=True)
    email = Column(String(120), nullable=True)
    phone = Column(String(50), nullable=True)
    address = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    purchase_orders = relationship("PurchaseOrder", back_populates="supplier")
    subscriptions = relationship("SerialSubscription", back_populates="supplier")

class PurchaseOrder(Base):
    """Purchase Order for bibliographic item acquisitions (FR01)."""
    __tablename__ = "purchase_orders"

    id = Column(Integer, primary_key=True, index=True)
    po_number = Column(String(50), unique=True, nullable=False, index=True)
    supplier_id = Column(Integer, ForeignKey("suppliers.id"), nullable=False, index=True)
    order_date = Column(Date, default=lambda: datetime.now(timezone.utc).date())
    expected_delivery_date = Column(Date, nullable=True)
    status = Column(String(30), default="ordered", nullable=False, index=True)  # draft, ordered, received, cancelled
    total_cost = Column(Float, default=0.0, nullable=False)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    supplier = relationship("Supplier", back_populates="purchase_orders")
    items = relationship("PurchaseOrderItem", back_populates="purchase_order", cascade="all, delete-orphan")

class PurchaseOrderItem(Base):
    """Individual line item within a Purchase Order (FR01)."""
    __tablename__ = "purchase_order_items"

    id = Column(Integer, primary_key=True, index=True)
    purchase_order_id = Column(Integer, ForeignKey("purchase_orders.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    author = Column(String(150), nullable=True)
    isbn = Column(String(32), nullable=True)
    quantity = Column(Integer, default=1, nullable=False)
    unit_price = Column(Float, default=0.0, nullable=False)
    received_quantity = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    purchase_order = relationship("PurchaseOrder", back_populates="items")

class SerialSubscription(Base):
    """Periodical / Serial subscription record (FR01)."""
    __tablename__ = "serial_subscriptions"

    id = Column(Integer, primary_key=True, index=True)
    subscription_code = Column(String(50), unique=True, nullable=False, index=True)
    title = Column(String(255), nullable=False, index=True)
    issn = Column(String(32), nullable=True, index=True)
    supplier_id = Column(Integer, ForeignKey("suppliers.id"), nullable=True, index=True)
    frequency = Column(String(50), default="Monthly", nullable=False)  # Weekly, Monthly, Quarterly, Annual
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    annual_cost = Column(Float, default=0.0, nullable=False)
    status = Column(String(30), default="active", nullable=False, index=True)  # active, expired, cancelled
    shelf_location = Column(String(50), default="PERIODICALS-BAY-1", nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    supplier = relationship("Supplier", back_populates="subscriptions")
    issues = relationship("SerialIssue", back_populates="subscription", cascade="all, delete-orphan")

class SerialIssue(Base):
    """Individual serial / journal issue received under a subscription (FR01)."""
    __tablename__ = "serial_issues"

    id = Column(Integer, primary_key=True, index=True)
    subscription_id = Column(Integer, ForeignKey("serial_subscriptions.id", ondelete="CASCADE"), nullable=False, index=True)
    volume = Column(String(30), nullable=False)
    issue_number = Column(String(30), nullable=False)
    publication_date = Column(Date, nullable=False)
    received_date = Column(Date, nullable=True)
    status = Column(String(30), default="expected", nullable=False)  # expected, received, missing
    accession_number = Column(String(50), nullable=True, index=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    subscription = relationship("SerialSubscription", back_populates="issues")
