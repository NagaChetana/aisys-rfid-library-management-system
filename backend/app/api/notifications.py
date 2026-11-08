from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.notification import NotificationQueue
from app.schemas.notification import NotificationOut, TestNotificationRequest
from app.services import notification_service

router = APIRouter(prefix="/notifications", tags=["Notifications & Dispatch Queue"])

@router.get("", response_model=List[NotificationOut])
def get_notifications(
    status: Optional[str] = Query(None),
    channel: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=100),
    skip: int = Query(0, ge=0),
    db: Session = Depends(get_db)
):
    """Retrieves notification queue history and transmission status (FR09)."""
    return notification_service.list_notifications(db, status=status, channel=channel, limit=limit, skip=skip)

@router.post("/send-test", response_model=NotificationOut, status_code=status.HTTP_201_CREATED)
def send_test_notification(
    req: TestNotificationRequest,
    db: Session = Depends(get_db)
):
    """Dispatches a test notification through the configured provider adapter."""
    return notification_service.enqueue_and_send(
        db,
        channel=req.channel,
        recipient=req.recipient,
        subject=req.subject,
        body=req.body
    )
