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

@router.post("/{notification_id}/retry", response_model=NotificationOut)
def retry_notification(
    notification_id: int,
    db: Session = Depends(get_db)
):
    """Retries delivery of a failed or queued notification (FR09)."""
    from fastapi import HTTPException
    try:
        return notification_service.retry_failed_notification(db, notification_id)
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(ve))

@router.get("/adapters")
def list_notification_adapters():
    """Lists registered provider-neutral notification gateways (FR09)."""
    from app.notifications.adapters import default_email_adapter, default_sms_adapter, default_print_adapter
    return {
        "adapters": [
            {
                "channel": "email",
                "provider": "Mock SMTP/SES Gateway",
                "status": "active",
                "sent_count": len(default_email_adapter.get_sent_mail())
            },
            {
                "channel": "sms",
                "provider": "Mock SMS Gateway (SMPP / Twilio)",
                "status": "active",
                "sent_count": len(default_sms_adapter._sent_sms)
            },
            {
                "channel": "print",
                "provider": "Mock Thermal Slip Printer (ESC/POS)",
                "status": "active",
                "printed_count": len(default_print_adapter.get_print_jobs())
            }
        ]
    }

