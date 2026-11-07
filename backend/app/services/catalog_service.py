from typing import List, Optional, Tuple
import uuid
from sqlalchemy.orm import Session
from sqlalchemy import or_, func
from app.models.catalog import Book, BookItem, Author, Category
from app.models.rfid import RfidTag
from app.schemas.book import BookCreate, BookUpdate, BookItemCreate, VirtualShelfItem
from app.services.audit_service import log_audit_event

def get_or_create_author(db: Session, author_name: str) -> Author:
    author = db.query(Author).filter(func.lower(Author.name) == author_name.strip().lower()).first()
    if not author:
        author = Author(name=author_name.strip())
        db.add(author)
        db.flush()
    return author

def get_or_create_category(db: Session, category_code: str, category_name: Optional[str] = None) -> Category:
    category = db.query(Category).filter(Category.code == category_code.strip().upper()).first()
    if not category:
        category = Category(
            code=category_code.strip().upper(),
            name=category_name or f"Category {category_code.strip().upper()}",
            dewey_range=f"{category_code[:1]}00-{category_code[:1]}99" if len(category_code) >= 1 and category_code[:1].isdigit() else "000-099"
        )
        db.add(category)
        db.flush()
    return category

def generate_accession_number(db: Session, offset: int = 0) -> str:
    max_id = db.query(func.max(BookItem.id)).scalar() or 0
    next_val = max_id + 1 + offset
    return f"ACC-{next_val:06d}"

def generate_barcode(db: Session, offset: int = 0) -> str:
    max_id = db.query(func.max(BookItem.id)).scalar() or 0
    next_val = max_id + 1 + offset
    return f"BC{next_val:08d}"

def get_books(
    db: Session,
    skip: int = 0,
    limit: int = 50,
    search: Optional[str] = None,
    category_id: Optional[int] = None,
    shelf_location: Optional[str] = None,
    status_filter: Optional[str] = None,
    is_serial: Optional[bool] = None
) -> Tuple[List[Book], int]:
    query = db.query(Book)
    
    if search:
        search_term = f"%{search.strip()}%"
        query = query.join(Author).join(Category).filter(
            or_(
                Book.title.ilike(search_term),
                Book.isbn.ilike(search_term),
                Book.call_number.ilike(search_term),
                Author.name.ilike(search_term),
                Category.name.ilike(search_term)
            )
        )
    
    if category_id:
        query = query.filter(Book.category_id == category_id)
        
    if is_serial is not None:
        query = query.filter(Book.is_serial == is_serial)

    if shelf_location or status_filter:
        query = query.join(BookItem)
        if shelf_location:
            query = query.filter(BookItem.shelf_location == shelf_location)
        if status_filter:
            query = query.filter(BookItem.status == status_filter)
        query = query.distinct()

    total = query.count()
    books = query.order_by(Book.id.desc()).offset(skip).limit(limit).all()
    return books, total

def get_book_by_id(db: Session, book_id: int) -> Optional[Book]:
    return db.query(Book).filter(Book.id == book_id).first()

def get_book_by_isbn(db: Session, isbn: str) -> Optional[Book]:
    return db.query(Book).filter(Book.isbn == isbn.strip()).first()

def create_book(db: Session, book_in: BookCreate, actor_id: Optional[int] = None) -> Book:
    # Resolve Author
    if book_in.author_id:
        author = db.query(Author).filter(Author.id == book_in.author_id).first()
        if not author:
            raise ValueError(f"Author with id {book_in.author_id} not found")
        author_id = author.id
    elif book_in.author_name:
        author = get_or_create_author(db, book_in.author_name)
        author_id = author.id
    else:
        raise ValueError("Either author_id or author_name is required")

    # Resolve Category
    if book_in.category_id:
        category = db.query(Category).filter(Category.id == book_in.category_id).first()
        if not category:
            raise ValueError(f"Category with id {book_in.category_id} not found")
        category_id = category.id
    elif book_in.category_code:
        category = get_or_create_category(db, book_in.category_code)
        category_id = category.id
    else:
        # Default category
        category = get_or_create_category(db, "GEN", "General Works")
        category_id = category.id

    # Create Book
    book = Book(
        isbn=book_in.isbn.strip(),
        title=book_in.title.strip(),
        subtitle=book_in.subtitle,
        author_id=author_id,
        category_id=category_id,
        publisher=book_in.publisher,
        publish_year=book_in.publish_year,
        edition=book_in.edition,
        pages=book_in.pages,
        description=book_in.description,
        is_serial=book_in.is_serial,
        call_number=book_in.call_number or f"{category.code}.{book_in.isbn[-4:]}"
    )
    db.add(book)
    db.flush()

    # Create Initial Copies / BookItems
    copies_to_create = max(1, book_in.initial_copies)
    for copy_idx in range(1, copies_to_create + 1):
        accession = generate_accession_number(db, offset=copy_idx - 1)
        barcode = generate_barcode(db, offset=copy_idx - 1)
        item = BookItem(
            book_id=book.id,
            accession_number=accession,
            barcode=barcode,
            copy_number=copy_idx,
            shelf_location=book_in.shelf_location,
            status="available",
            is_reference_only=book_in.is_reference_only,
            price=0.0
        )
        db.add(item)
    
    db.flush()
    log_audit_event(
        db,
        action="BOOK_CATALOGUED",
        resource_type="book",
        resource_id=str(book.id),
        actor_user_id=actor_id,
        details={"title": book.title, "isbn": book.isbn, "copies_created": copies_to_create}
    )
    db.commit()
    db.refresh(book)
    return book

def add_book_item(db: Session, book_id: int, item_in: BookItemCreate, actor_id: Optional[int] = None) -> BookItem:
    book = get_book_by_id(db, book_id)
    if not book:
        raise ValueError(f"Book with id {book_id} not found")

    existing_copies = db.query(BookItem).filter(BookItem.book_id == book_id).count()
    next_copy_num = item_in.copy_number or (existing_copies + 1)
    
    accession = item_in.accession_number or generate_accession_number(db)
    barcode = item_in.barcode or generate_barcode(db)

    item = BookItem(
        book_id=book.id,
        accession_number=accession,
        barcode=barcode,
        copy_number=next_copy_num,
        shelf_location=item_in.shelf_location,
        status=item_in.status,
        is_reference_only=item_in.is_reference_only,
        price=item_in.price
    )
    db.add(item)
    db.flush()
    log_audit_event(
        db,
        action="ITEM_COPY_ADDED",
        resource_type="book_item",
        resource_id=str(item.id),
        actor_user_id=actor_id,
        details={"book_id": book_id, "accession": accession, "barcode": barcode}
    )
    db.commit()
    db.refresh(item)
    return item

def get_item_by_accession(db: Session, accession_number: str) -> Optional[BookItem]:
    return db.query(BookItem).filter(BookItem.accession_number == accession_number.strip()).first()

def get_item_by_barcode(db: Session, barcode: str) -> Optional[BookItem]:
    return db.query(BookItem).filter(BookItem.barcode == barcode.strip()).first()

def get_item_by_tag(db: Session, tag_uid: str) -> Optional[BookItem]:
    tag = db.query(RfidTag).filter(RfidTag.tag_uid == tag_uid.strip()).first()
    if tag and tag.book_item_id:
        return db.query(BookItem).filter(BookItem.id == tag.book_item_id).first()
    return None

def get_virtual_bookshelf(db: Session, category_code: Optional[str] = None) -> List[VirtualShelfItem]:
    query = db.query(Book).join(Author).join(Category)
    if category_code:
        query = query.filter(Category.code == category_code.strip().upper())
    
    books = query.order_by(Book.call_number.asc()).limit(30).all()
    shelf_items = []
    for b in books:
        total_copies = len(b.items)
        available_copies = sum(1 for it in b.items if it.status == "available")
        shelf_items.append(
            VirtualShelfItem(
                id=b.id,
                isbn=b.isbn,
                title=b.title,
                author=b.author.name if b.author else "Unknown",
                call_number=b.call_number,
                category_code=b.category.code if b.category else "GEN",
                shelf_location=b.items[0].shelf_location if b.items else "MAIN-SHELF-A",
                available_copies=available_copies,
                total_copies=total_copies
            )
        )
    return shelf_items
