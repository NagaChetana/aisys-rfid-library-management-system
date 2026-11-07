from typing import Optional
from datetime import datetime
from pydantic import BaseModel, EmailStr, ConfigDict

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserOut"

class TokenData(BaseModel):
    username: Optional[str] = None
    role: Optional[str] = None

class LoginRequest(BaseModel):
    username: str
    password: str

class SmartCardLoginRequest(BaseModel):
    smart_card_uid: str  # Simulated RFID / NFC badge UID

class RoleOut(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    permissions: str

    model_config = ConfigDict(from_attributes=True)

class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str
    role_id: int
    full_name: str
    smart_card_uid: Optional[str] = None

class UserOut(BaseModel):
    id: int
    username: str
    email: str
    full_name: str
    role_id: int
    role_name: Optional[str] = None
    smart_card_uid: Optional[str] = None
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
