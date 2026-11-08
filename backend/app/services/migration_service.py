import csv
import io
import json
import uuid
import re
from datetime import datetime, timezone
from typing import List, Dict, Any, Tuple, Optional, Set
from sqlalchemy.orm import Session
from sqlalchemy import desc, func
from app.models.migration import MigrationBatch, StagedRecord
from app.models.catalog import Book, BookItem, Author, Category
from app.models.rfid import RfidTag
from app.schemas.migration import MigrationValidationReport, StagedRowError
from app.services.audit_service import log_audit_event
from app.services.event_broadcaster import broadcaster

def validate_isbn(isbn_str: str) -> bool:
    """Validates ISBN-10 or ISBN-13 format (allowing hyphens)."""
    clean = re.sub(r'[\s-]', '', isbn_str)
    if len(clean) not in [10, 13]:
        return False
    return bool(re.match(r'^[0-9Xx]+$', clean))

def stage_csv_data(
    db: Session,
    filename: str,
    csv_content: str
) -> MigrationBatch:
    """
    Parses, validates, and stages spreadsheet library records (FR10, AC01).
    Detects duplicates and invalid values before committing to production tables.
    """
    batch_number = f"BATCH-MIG-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:4].upper()}"

    batch = MigrationBatch(
        batch_number=batch_number,
        filename=filename,
        total_records=0,
        valid_records=0,
        invalid_records=0,
        migrated_records=0,
        status="staged",
        error_log=None,
        created_at=datetime.now(timezone.utc)
    )
    db.add(batch)
    db.commit()
    db.refresh(batch)

    # Pre-fetch existing database ISBNs and accessions to detect duplicate collisions
    existing_isbns: Set[str] = set(row[0] for row in db.query(Book.isbn).all() if row[0])
    existing_accessions: Set[str] = set(row[0] for row in db.query(BookItem.accession_number).all() if row[0])

    reader = csv.DictReader(io.StringIO(csv_content))
    seen_batch_isbns: Set[str] = set()
    seen_batch_accessions: Set[str] = set()

    total_count = 0
    valid_count = 0
    invalid_count = 0
    staged_records_buffer: List[StagedRecord] = []
    error_summary: List[str] = []

    for row_idx, row in enumerate(reader, start=1):
        total_count += 1
        errors: List[str] = []

        title = (row.get("title") or "").strip()
        author = (row.get("author") or "").strip()
        isbn = (row.get("isbn") or "").strip()
        category_code = (row.get("category_code") or "").strip()
        accession = (row.get("accession_number") or "").strip()

        # 1. Mandatory field checks
        if not title:
            errors.append("Missing mandatory 'title' field")
        if not author:
            errors.append("Missing mandatory 'author' field")
        if not isbn:
            errors.append("Missing mandatory 'isbn' field")
        elif not validate_isbn(isbn):
            errors.append(f"Invalid ISBN format: '{isbn}'")

        # 2. Duplicate detection within batch
        if isbn:
            if isbn in seen_batch_isbns:
                errors.append(f"Duplicate ISBN within batch: '{isbn}'")
            else:
                seen_batch_isbns.add(isbn)

        if accession:
            if accession in seen_batch_accessions:
                errors.append(f"Duplicate Accession within batch: '{accession}'")
            else:
                seen_batch_accessions.add(accession)

            # 3. Duplicate detection against existing database
            if accession in existing_accessions:
                errors.append(f"Accession '{accession}' already exists in database")

        if isbn and isbn in existing_isbns:
            errors.append(f"Book with ISBN '{isbn}' already exists in database")

        is_valid = len(errors) == 0
        if is_valid:
            valid_count += 1
        else:
            invalid_count += 1
            if len(error_summary) < 50:
                error_summary.append(f"Row {row_idx} ({title or 'No Title'}): {'; '.join(errors)}")

        staged_rec = StagedRecord(
            migration_batch_id=batch.id,
            row_number=row_idx,
            raw_data=json.dumps(row),
            is_valid=is_valid,
            validation_errors=json.dumps(errors) if errors else None,
            created_at=datetime.now(timezone.utc)
        )
        staged_records_buffer.append(staged_rec)

        # Batch flush to avoid memory ballooning during 20,000-record staging
        if len(staged_records_buffer) >= 2000:
            db.bulk_save_objects(staged_records_buffer)
            db.commit()
            staged_records_buffer.clear()

    if staged_records_buffer:
        db.bulk_save_objects(staged_records_buffer)
        db.commit()
        staged_records_buffer.clear()

    batch.total_records = total_count
    batch.valid_records = valid_count
    batch.invalid_records = invalid_count
    batch.status = "validated" if invalid_count == 0 else "validated_with_errors"
    batch.error_log = "\n".join(error_summary) if error_summary else None

    db.commit()
    db.refresh(batch)

    log_audit_event(
        db,
        action="DATA_MIGRATION_STAGED",
        resource_type="migration_batch",
        resource_id=str(batch.id),
        details={
            "batch_number": batch.batch_number,
            "total": total_count,
            "valid": valid_count,
            "invalid": invalid_count
        }
    )

    broadcaster.broadcast("migration_staged", {
        "batch_id": batch.id,
        "batch_number": batch.batch_number,
        "total_records": total_count,
        "valid_records": valid_count,
        "invalid_records": invalid_count
    })

    return batch

def execute_migration(db: Session, batch_id: int) -> MigrationBatch:
    """
    Executes atomic migration of valid staged records into production catalog (FR10, AC10).
    Tags all created records with migration_batch_id for scoped rollback guarantee.
    """
    batch = db.query(MigrationBatch).filter(MigrationBatch.id == batch_id).first()
    if not batch:
        raise ValueError(f"Migration batch #{batch_id} not found.")

    if batch.status not in ["staged", "validated", "validated_with_errors"]:
        raise ValueError(f"Batch #{batch_id} cannot be executed in status '{batch.status}'.")

    # Fetch valid staged records in chunks
    valid_staged = db.query(StagedRecord).filter(
        StagedRecord.migration_batch_id == batch.id,
        StagedRecord.is_valid.is_(True)
    ).all()

    if not valid_staged:
        raise ValueError(f"No valid records available to migrate in batch #{batch_id}.")

    # Category and Author cache
    categories = {c.code: c.id for c in db.query(Category).all()}
    default_cat_id = categories.get("000") or db.query(Category.id).first()[0]
    author_cache: Dict[str, int] = {a.name.lower(): a.id for a in db.query(Author).all()}

    # Max IDs for auto-increment generation
    max_acc = db.query(func.max(BookItem.id)).scalar() or 0

    now = datetime.now(timezone.utc)
    migrated_count = 0

    try:
        # Atomic commit in chunks
        for idx, rec in enumerate(valid_staged, start=1):
            data = json.loads(rec.raw_data)
            author_name = data.get("author", "Unknown Author").strip()
            author_key = author_name.lower()

            if author_key in author_cache:
                author_id = author_cache[author_key]
            else:
                new_author = Author(name=author_name)
                db.add(new_author)
                db.flush()
                author_id = new_author.id
                author_cache[author_key] = author_id

            cat_code = data.get("category_code", "").strip()
            cat_id = categories.get(cat_code, default_cat_id)

            book = Book(
                isbn=data.get("isbn").strip(),
                title=data.get("title").strip(),
                subtitle=data.get("subtitle"),
                publisher=data.get("publisher", "Academic Press"),
                publish_year=int(data.get("publish_year") or 2024),
                edition=data.get("edition", "1st"),
                call_number=data.get("call_number"),
                author_id=author_id,
                category_id=cat_id,
                migration_batch_id=batch.id,
                created_at=now,
                updated_at=now
            )

            max_acc += 1
            accession_number = data.get("accession_number") or f"ACC-{max_acc:06d}"
            barcode = data.get("barcode") or f"BAR-{max_acc:06d}"
            shelf = data.get("shelf_location") or "CS-SHELF-01"

            item = BookItem(
                accession_number=accession_number,
                barcode=barcode,
                copy_number=1,
                shelf_location=shelf,
                status="available",
                is_reference_only=str(data.get("is_reference_only", "")).lower() in ["true", "1", "yes"],
                price=float(data.get("price") or 25.0),
                migration_batch_id=batch.id,
                created_at=now
            )

            # Auto-generate unique EPC Gen2 RFID tag
            tag_uid = f"E2801160{uuid.uuid4().hex[:16].upper()}"
            tag = RfidTag(
                tag_uid=tag_uid,
                item_type="book_item",
                eas_bit=True,
                status="active",
                last_scanned_at=now,
                created_at=now
            )

            item.rfid_tag = tag
            book.items = [item]
            db.add(book)

            migrated_count += 1

            if idx % 1000 == 0:
                db.flush()

        db.flush()
        batch.migrated_records = migrated_count
        batch.status = "migrated"
        batch.migrated_at = now

        db.commit()
        db.refresh(batch)

        log_audit_event(
            db,
            action="DATA_MIGRATION_EXECUTED",
            resource_type="migration_batch",
            resource_id=str(batch.id),
            details={"batch_number": batch.batch_number, "migrated_count": migrated_count}
        )

        broadcaster.broadcast("migration_executed", {
            "batch_id": batch.id,
            "migrated_records": migrated_count,
            "status": "migrated"
        })

        return batch
    except Exception as e:
        db.rollback()
        batch.status = "failed"
        batch.error_log = f"Migration execution aborted: {str(e)}"
        db.commit()
        raise

def rollback_migration(db: Session, batch_id: int) -> Dict[str, Any]:
    """
    Executes scoped rollback for records created by a specific migration batch (FR10, NFR01).
    Guarantees pre-existing library records are preserved untouched!
    """
    batch = db.query(MigrationBatch).filter(MigrationBatch.id == batch_id).first()
    if not batch:
        raise ValueError(f"Migration batch #{batch_id} not found.")

    if batch.status != "migrated":
        raise ValueError(f"Only batches in 'migrated' status can be rolled back. Current status: '{batch.status}'.")

    try:
        # 1. Identify book_item IDs belonging to this migration batch
        item_ids = [
            row[0] for row in db.query(BookItem.id).filter(
                BookItem.migration_batch_id == batch.id
            ).all()
        ]

        # 2. Delete RFID tags attached to these items
        if item_ids:
            db.query(RfidTag).filter(RfidTag.book_item_id.in_(item_ids)).delete(synchronize_session=False)

        # 3. Delete BookItems belonging to this migration batch
        deleted_items = db.query(BookItem).filter(
            BookItem.migration_batch_id == batch.id
        ).delete(synchronize_session=False)

        # 4. Delete Books belonging to this migration batch
        deleted_books = db.query(Book).filter(
            Book.migration_batch_id == batch.id
        ).delete(synchronize_session=False)

        # Update batch status
        batch.status = "rolled_back"
        batch.migrated_records = 0
        db.commit()
        db.refresh(batch)

        log_audit_event(
            db,
            action="DATA_MIGRATION_ROLLEDBACK",
            resource_type="migration_batch",
            resource_id=str(batch.id),
            details={
                "batch_number": batch.batch_number,
                "deleted_books": deleted_books,
                "deleted_items": deleted_items
            }
        )

        broadcaster.broadcast("migration_rolled_back", {
            "batch_id": batch.id,
            "batch_number": batch.batch_number,
            "deleted_books": deleted_books,
            "deleted_items": deleted_items
        })

        return {
            "batch_id": batch.id,
            "batch_number": batch.batch_number,
            "status": "rolled_back",
            "deleted_books_count": deleted_books,
            "deleted_items_count": deleted_items,
            "message": f"Successfully reversed {deleted_books} books and {deleted_items} items created by batch {batch.batch_number}."
        }
    except Exception as e:
        db.rollback()
        raise

def get_validation_report(db: Session, batch_id: int) -> MigrationValidationReport:
    batch = db.query(MigrationBatch).filter(MigrationBatch.id == batch_id).first()
    if not batch:
        raise ValueError(f"Migration batch #{batch_id} not found.")

    invalid_records = db.query(StagedRecord).filter(
        StagedRecord.migration_batch_id == batch_id,
        StagedRecord.is_valid.is_(False)
    ).limit(50).all()

    sample_errors: List[StagedRowError] = []
    dup_count = 0

    for rec in invalid_records:
        errs = json.loads(rec.validation_errors or "[]")
        data = json.loads(rec.raw_data or "{}")
        if any("duplicate" in e.lower() for e in errs):
            dup_count += 1
        sample_errors.append(
            StagedRowError(
                row_number=rec.row_number,
                title=data.get("title"),
                errors=errs
            )
        )

    return MigrationValidationReport(
        batch_id=batch.id,
        batch_number=batch.batch_number,
        filename=batch.filename,
        status=batch.status,
        total_records=batch.total_records,
        valid_records=batch.valid_records,
        invalid_records=batch.invalid_records,
        duplicate_records=dup_count,
        sample_errors=sample_errors
    )

def generate_synthetic_library_csv(record_count: int = 20000, invalid_count: int = 100) -> str:
    """
    Generates synthetic ~20,000-record CSV dataset in memory for migration testing and demonstration (FR10).
    Injects a configurable small fraction of invalid records to verify validation error logging.
    """
    output = io.StringIO()
    fieldnames = [
        "title", "subtitle", "author", "isbn", "category_code",
        "publisher", "publish_year", "shelf_location", "price", "is_reference_only"
    ]
    writer = csv.DictWriter(output, fieldnames=fieldnames)
    writer.writeheader()

    categories = ["004", "005", "510", "530", "620", "658"]
    shelves = ["CS-SHELF-01", "CS-SHELF-02", "MATH-SHELF-01", "PHYS-SHELF-01", "ENG-SHELF-01"]
    topics = [
        "Algorithms and Data Structures", "Distributed Cloud Architecture", "Applied Neural Networks",
        "Modern Relational Databases", "Quantum Computation Principles", "Operating System Kernels",
        "Compiler Optimization", "Cybersecurity & Cryptography", "Computer Vision and Imaging",
        "Statistical Machine Learning", "Robotics and Embedded Systems", "Software Design Patterns"
    ]
    authors = [
        "Dr. Alan Turing", "Grace Hopper", "Donald Knuth", "Ada Lovelace", "Claude Shannon",
        "Barbara Liskov", "Edsger Dijkstra", "Leslie Lamport", "John von Neumann", "Tim Berners-Lee"
    ]

    base_isbn_prefix = 9781000000000

    for i in range(1, record_count + 1):
        is_invalid = i <= invalid_count
        topic = topics[i % len(topics)]
        author = authors[i % len(authors)]
        category = categories[i % len(categories)]
        shelf = shelves[i % len(shelves)]
        isbn = f"{base_isbn_prefix + i}"

        if is_invalid:
            # Intentionally inject bad rows for error detection verification
            if i % 3 == 0:
                # Missing title
                title = ""
            elif i % 3 == 1:
                # Bad ISBN
                isbn = "BAD-ISBN-NOT-DIGITS"
                title = f"{topic} (Vol. {i})"
            else:
                # Missing author
                author = ""
                title = f"{topic} (Vol. {i})"
        else:
            title = f"{topic}: Advanced Concepts Vol. {i}"

        writer.writerow({
            "title": title,
            "subtitle": f"Special Edition {i}",
            "author": author,
            "isbn": isbn,
            "category_code": category,
            "publisher": "Academic Press",
            "publish_year": 2015 + (i % 10),
            "shelf_location": shelf,
            "price": 45.0 + (i % 50),
            "is_reference_only": "1" if (i % 20 == 0) else "0"
        })

    return output.getvalue()
