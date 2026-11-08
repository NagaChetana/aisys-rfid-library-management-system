from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import desc
from app.core.database import get_db
from app.models.migration import MigrationBatch
from app.schemas.migration import (
    MigrationBatchOut, MigrationValidationReport, GenerateSyntheticRequest
)
from app.services import migration_service

router = APIRouter(prefix="/migration", tags=["Data Migration (20,000-Record Staging & Rollback)"])

@router.post("/upload", response_model=MigrationBatchOut, status_code=status.HTTP_201_CREATED)
async def upload_csv_file(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """
    Uploads, validates, and stages spreadsheet library catalog records (FR10, AC01).
    Performs field format checking and duplicate detection prior to migration.
    """
    content = await file.read()
    try:
        csv_text = content.decode("utf-8")
    except UnicodeDecodeError:
        csv_text = content.decode("latin-1")

    batch = migration_service.stage_csv_data(db, filename=file.filename or "upload.csv", csv_content=csv_text)
    return MigrationBatchOut.model_validate(batch)

@router.post("/generate-synthetic", response_model=MigrationBatchOut, status_code=status.HTTP_201_CREATED)
def generate_and_stage_synthetic(
    req: GenerateSyntheticRequest,
    db: Session = Depends(get_db)
):
    """
    Generates synthetic ~20,000-record library dataset in-memory and stages it with validation (FR10, AC01).
    Validates high-volume ingestion performance without requiring external files.
    """
    csv_text = migration_service.generate_synthetic_library_csv(
        record_count=req.record_count,
        invalid_count=req.invalid_count
    )
    filename = f"synthetic_catalog_{req.record_count}_records.csv"
    batch = migration_service.stage_csv_data(db, filename=filename, csv_content=csv_text)
    return MigrationBatchOut.model_validate(batch)

@router.get("/batches", response_model=List[MigrationBatchOut])
def list_batches(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db)
):
    """Lists historical and active migration batches."""
    batches = db.query(MigrationBatch).order_by(desc(MigrationBatch.id)).offset(skip).limit(limit).all()
    return [MigrationBatchOut.model_validate(b) for b in batches]

@router.get("/batches/{batch_id}", response_model=MigrationBatchOut)
def get_batch(
    batch_id: int,
    db: Session = Depends(get_db)
):
    batch = db.query(MigrationBatch).filter(MigrationBatch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail=f"Migration batch #{batch_id} not found")
    return MigrationBatchOut.model_validate(batch)

@router.get("/batches/{batch_id}/report", response_model=MigrationValidationReport)
def get_validation_report(
    batch_id: int,
    db: Session = Depends(get_db)
):
    """Returns detailed reconciliation metrics, valid/invalid record counts, and row error samples."""
    try:
        return migration_service.get_validation_report(db, batch_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.post("/batches/{batch_id}/execute", response_model=MigrationBatchOut)
def execute_batch_migration(
    batch_id: int,
    db: Session = Depends(get_db)
):
    """
    Executes atomic migration of staged valid records into production tables (AC10).
    Tags all records with migration_batch_id.
    """
    try:
        batch = migration_service.execute_migration(db, batch_id)
        return MigrationBatchOut.model_validate(batch)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/batches/{batch_id}/rollback", response_model=dict)
def rollback_batch_migration(
    batch_id: int,
    db: Session = Depends(get_db)
):
    """
    Executes scoped rollback for records created by a specific migration batch (NFR01).
    Guarantees pre-existing library records are never deleted or modified.
    """
    try:
        return migration_service.rollback_migration(db, batch_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
