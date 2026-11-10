from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import get_current_user_optional, require_role
from app.schemas.book import (
    BookCreate, BookUpdate, BookOut, BookItemCreate, BookItemOut,
    VirtualShelfItem, AuthorOut, CategoryOut
)
from app.services import catalog_service
from app.models.catalog import Author, Category

router = APIRouter(prefix="/books", tags=["Catalog & Books"])

def map_book_to_out(book) -> BookOut:
    copies = [
        BookItemOut(
            id=item.id,
            book_id=item.book_id,
            accession_number=item.accession_number,
            barcode=item.barcode,
            copy_number=item.copy_number,
            shelf_location=item.shelf_location,
            status=item.status,
            is_reference_only=item.is_reference_only,
            price=item.price,
            migration_batch_id=item.migration_batch_id,
            rfid_tag_uid=item.rfid_tag.tag_uid if item.rfid_tag else None,
            rfid_eas_bit=item.rfid_tag.eas_bit if item.rfid_tag else None,
            created_at=item.created_at
        )
        for item in book.items
    ]
    return BookOut(
        id=book.id,
        isbn=book.isbn,
        title=book.title,
        subtitle=book.subtitle,
        publisher=book.publisher,
        publish_year=book.publish_year,
        edition=book.edition,
        pages=book.pages,
        description=book.description,
        is_serial=book.is_serial,
        call_number=book.call_number,
        author_id=book.author_id,
        author_name=book.author.name if book.author else None,
        category_id=book.category_id,
        category_name=book.category.name if book.category else None,
        category_code=book.category.code if book.category else None,
        copies_count=len(copies),
        available_copies_count=sum(1 for c in copies if c.status == "available" and not c.is_reference_only),
        migration_batch_id=book.migration_batch_id,
        items=copies,
        created_at=book.created_at,
        updated_at=book.updated_at
    )

@router.get("", response_model=dict)
def list_books(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    q: Optional[str] = Query(None, description="Full-text search keyword"),
    category_id: Optional[int] = Query(None),
    shelf_location: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    is_serial: Optional[bool] = Query(None),
    db: Session = Depends(get_db)
):
    books, total = catalog_service.get_books(
        db,
        skip=skip,
        limit=limit,
        search=q,
        category_id=category_id,
        shelf_location=shelf_location,
        status_filter=status,
        is_serial=is_serial
    )
    items = [map_book_to_out(b) for b in books]
    return {"items": items, "total": total, "skip": skip, "limit": limit}

@router.post("", response_model=BookOut, status_code=status.HTTP_201_CREATED)
def create_book(
    book_in: BookCreate,
    db: Session = Depends(get_db),
    user = Depends(require_role(["ADMIN", "LIBRARIAN"]))
):
    actor_id = user.id if user else None
    existing = catalog_service.get_book_by_isbn(db, book_in.isbn)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Book with ISBN '{book_in.isbn}' already exists (ID: {existing.id})"
        )
    try:
        book = catalog_service.create_book(db, book_in, actor_id=actor_id)
        return map_book_to_out(book)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

@router.get("/virtual-shelf", response_model=List[VirtualShelfItem])
def get_virtual_bookshelf(
    category_code: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    return catalog_service.get_virtual_bookshelf(db, category_code=category_code)

@router.get("/categories", response_model=List[CategoryOut])
def list_categories(db: Session = Depends(get_db)):
    return db.query(Category).order_by(Category.code.asc()).all()

@router.get("/authors", response_model=List[AuthorOut])
def list_authors(db: Session = Depends(get_db)):
    return db.query(Author).order_by(Author.name.asc()).limit(100).all()

@router.get("/items/{accession_number}", response_model=BookItemOut)
def get_item_by_accession(accession_number: str, db: Session = Depends(get_db)):
    item = catalog_service.get_item_by_accession(db, accession_number)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Item with accession '{accession_number}' not found")
    return BookItemOut(
        id=item.id,
        book_id=item.book_id,
        accession_number=item.accession_number,
        barcode=item.barcode,
        copy_number=item.copy_number,
        shelf_location=item.shelf_location,
        status=item.status,
        is_reference_only=item.is_reference_only,
        price=item.price,
        migration_batch_id=item.migration_batch_id,
        rfid_tag_uid=item.rfid_tag.tag_uid if item.rfid_tag else None,
        rfid_eas_bit=item.rfid_tag.eas_bit if item.rfid_tag else None,
        created_at=item.created_at
    )

@router.get("/{id}", response_model=BookOut)
def get_book(id: int, db: Session = Depends(get_db)):
    book = catalog_service.get_book_by_id(db, id)
    if not book:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Book with id {id} not found")
    return map_book_to_out(book)

@router.post("/{id}/items", response_model=BookItemOut, status_code=status.HTTP_201_CREATED)
def add_copy(
    id: int,
    item_in: BookItemCreate,
    db: Session = Depends(get_db),
    user = Depends(require_role(["ADMIN", "LIBRARIAN"]))
):
    actor_id = user.id if user else None
    try:
        item = catalog_service.add_book_item(db, id, item_in, actor_id=actor_id)
        return BookItemOut(
            id=item.id,
            book_id=item.book_id,
            accession_number=item.accession_number,
            barcode=item.barcode,
            copy_number=item.copy_number,
            shelf_location=item.shelf_location,
            status=item.status,
            is_reference_only=item.is_reference_only,
            price=item.price,
            migration_batch_id=item.migration_batch_id,
            rfid_tag_uid=item.rfid_tag.tag_uid if item.rfid_tag else None,
            rfid_eas_bit=item.rfid_tag.eas_bit if item.rfid_tag else None,
            created_at=item.created_at
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

# --- BARCODE & SPINE LABEL WORKFLOWS (FR01) ---

@router.get("/items/{accession_number}/spine-label")
def get_spine_label(accession_number: str, db: Session = Depends(get_db)):
    """Generates standard library spine label layout and printable HTML (FR01)."""
    from app.services import label_service
    item = catalog_service.get_item_by_accession(db, accession_number)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Item with accession '{accession_number}' not found")

    book = item.book
    author_name = book.author.name if book and book.author else None
    dewey_code = book.category.code if book and book.category else "000"
    call_number = book.call_number if book else None
    title = book.title if book else "Unknown Title"

    payload = label_service.generate_spine_label_payload(
        call_number=call_number,
        dewey_code=dewey_code,
        author_name=author_name,
        title=title,
        accession_number=item.accession_number,
        barcode=item.barcode
    )
    return payload

@router.get("/items/{accession_number}/barcode")
def get_item_barcode(accession_number: str, db: Session = Depends(get_db)):
    """Generates pure vector Code-128 SVG barcode for thermal printing (FR01)."""
    from app.services import label_service
    from fastapi.responses import Response
    item = catalog_service.get_item_by_accession(db, accession_number)
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Item with accession '{accession_number}' not found")

    svg = label_service.generate_code128_svg(item.barcode or item.accession_number)
    return Response(content=svg, media_type="image/svg+xml")

