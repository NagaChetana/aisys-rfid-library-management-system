from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, ConfigDict

class AuthorBase(BaseModel):
    name: str
    biography: Optional[str] = None

class AuthorCreate(AuthorBase):
    pass

class AuthorOut(AuthorBase):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class CategoryBase(BaseModel):
    code: str
    name: str
    dewey_range: Optional[str] = None

class CategoryCreate(CategoryBase):
    pass

class CategoryOut(CategoryBase):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class BookItemBase(BaseModel):
    shelf_location: str = "MAIN-SHELF-A"
    status: str = "available"
    is_reference_only: bool = False
    price: float = 0.0

class BookItemCreate(BookItemBase):
    accession_number: Optional[str] = None
    barcode: Optional[str] = None
    copy_number: Optional[int] = None

class BookItemOut(BookItemBase):
    id: int
    book_id: int
    accession_number: str
    barcode: str
    copy_number: int
    migration_batch_id: Optional[int] = None
    rfid_tag_uid: Optional[str] = None
    rfid_eas_bit: Optional[bool] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class BookBase(BaseModel):
    isbn: str
    title: str
    subtitle: Optional[str] = None
    publisher: Optional[str] = None
    publish_year: Optional[int] = None
    edition: Optional[str] = None
    pages: Optional[int] = None
    description: Optional[str] = None
    is_serial: bool = False
    call_number: Optional[str] = None

class BookCreate(BookBase):
    author_id: Optional[int] = None
    author_name: Optional[str] = None
    category_id: Optional[int] = None
    category_code: Optional[str] = None
    initial_copies: int = 1
    shelf_location: str = "MAIN-SHELF-A"
    is_reference_only: bool = False

class BookUpdate(BaseModel):
    title: Optional[str] = None
    subtitle: Optional[str] = None
    publisher: Optional[str] = None
    publish_year: Optional[int] = None
    edition: Optional[str] = None
    pages: Optional[int] = None
    description: Optional[str] = None
    is_serial: Optional[bool] = None
    call_number: Optional[str] = None
    category_id: Optional[int] = None

class BookOut(BookBase):
    id: int
    author_id: int
    author_name: Optional[str] = None
    category_id: int
    category_name: Optional[str] = None
    category_code: Optional[str] = None
    copies_count: int = 0
    available_copies_count: int = 0
    migration_batch_id: Optional[int] = None
    items: List[BookItemOut] = []
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

class VirtualShelfItem(BaseModel):
    id: int
    isbn: str
    title: str
    author: str
    call_number: Optional[str]
    category_code: str
    shelf_location: str
    available_copies: int
    total_copies: int
