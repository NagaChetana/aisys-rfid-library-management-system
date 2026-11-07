from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, Float
from sqlalchemy.orm import relationship
from app.core.database import Base

class Author(Base):
    __tablename__ = "authors"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(150), nullable=False, index=True)
    biography = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    books = relationship("Book", back_populates="author")

class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), unique=True, nullable=False, index=True)  # e.g., "004", "800", "CS-AI"
    name = Column(String(100), nullable=False)
    dewey_range = Column(String(50), nullable=True)  # e.g., "000-099"
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    books = relationship("Book", back_populates="category")

class Book(Base):
    __tablename__ = "books"

    id = Column(Integer, primary_key=True, index=True)
    isbn = Column(String(32), unique=True, nullable=False, index=True)
    title = Column(String(255), nullable=False, index=True)
    subtitle = Column(String(255), nullable=True)
    author_id = Column(Integer, ForeignKey("authors.id"), nullable=False)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=False)
    publisher = Column(String(150), nullable=True)
    publish_year = Column(Integer, nullable=True)
    edition = Column(String(50), nullable=True)
    pages = Column(Integer, nullable=True)
    description = Column(Text, nullable=True)
    is_serial = Column(Boolean, default=False, nullable=False)
    call_number = Column(String(50), nullable=True, index=True)
    migration_batch_id = Column(Integer, ForeignKey("migration_batches.id", ondelete="SET NULL"), nullable=True, index=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    author = relationship("Author", back_populates="books")
    category = relationship("Category", back_populates="books")
    items = relationship("BookItem", back_populates="book", cascade="all, delete-orphan")
    migration_batch = relationship("MigrationBatch", foreign_keys=[migration_batch_id])

class BookItem(Base):
    __tablename__ = "book_items"

    id = Column(Integer, primary_key=True, index=True)
    book_id = Column(Integer, ForeignKey("books.id", ondelete="CASCADE"), nullable=False, index=True)
    accession_number = Column(String(50), unique=True, nullable=False, index=True)
    barcode = Column(String(50), unique=True, nullable=False, index=True)
    copy_number = Column(Integer, default=1, nullable=False)
    shelf_location = Column(String(50), nullable=False, default="MAIN-SHELF-A", index=True)
    status = Column(String(30), nullable=False, default="available", index=True)  # available, checked_out, maintenance, lost, missing
    is_reference_only = Column(Boolean, default=False, nullable=False)  # Enforces reference restriction
    price = Column(Float, default=0.0, nullable=False)
    migration_batch_id = Column(Integer, ForeignKey("migration_batches.id", ondelete="SET NULL"), nullable=True, index=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    book = relationship("Book", back_populates="items")
    rfid_tag = relationship("RfidTag", back_populates="book_item", uselist=False)
    migration_batch = relationship("MigrationBatch", foreign_keys=[migration_batch_id])
