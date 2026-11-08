from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, ConfigDict

class MigrationBatchOut(BaseModel):
    id: int
    batch_number: str
    filename: str
    total_records: int
    valid_records: int
    invalid_records: int
    migrated_records: int
    status: str
    error_log: Optional[str] = None
    created_at: datetime
    migrated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

class StagedRowError(BaseModel):
    row_number: int
    title: Optional[str] = None
    errors: List[str]

class MigrationValidationReport(BaseModel):
    batch_id: int
    batch_number: str
    filename: str
    status: str
    total_records: int
    valid_records: int
    invalid_records: int
    duplicate_records: int
    sample_errors: List[StagedRowError] = []

class GenerateSyntheticRequest(BaseModel):
    record_count: int = 20000
    invalid_count: int = 150
