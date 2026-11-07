import os
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    PROJECT_NAME: str = "RFID-Enabled Intelligent Library Management System"
    API_V1_STR: str = "/api"
    SECRET_KEY: str = "aisys-rfid-library-secret-key-2026-production-ready"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours
    
    # Database
    DATABASE_URL: str = "sqlite:///./data/library.db"
    
    # Business Rules
    MAX_FINE_LIMIT: float = 15.00
    DEFAULT_LOAN_PERIOD_DAYS: int = 14
    DEFAULT_GRACE_PERIOD_DAYS: int = 1
    MAX_RENEWAL_COUNT: int = 2
    DAILY_OVERDUE_FINE: float = 0.50
    DUPLICATE_EVENT_WINDOW_MS: int = 3000
    
    # CORS
    CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:5173", "http://127.0.0.1:5173"]
    
    model_config = SettingsConfigDict(case_sensitive=True, env_file=".env", extra="ignore")

settings = Settings()
