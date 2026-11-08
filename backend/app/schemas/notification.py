from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict

class NotificationOut(BaseModel):
    id: int
    channel: str
    recipient: str
    subject: Optional[str] = None
    body: str
    status: str
    attempts: int
    error_message: Optional[str] = None
    created_at: datetime
    sent_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

class TestNotificationRequest(BaseModel):
    channel: str = "email"
    recipient: str = "security@library.university.edu"
    subject: str = "Test Security Alert"
    body: str = "This is a simulated verification test of the notification adapter."
