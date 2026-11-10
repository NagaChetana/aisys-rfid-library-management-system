from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import desc
from app.models.notification import NotificationQueue
from app.notifications.adapters import default_email_adapter, default_sms_adapter, default_print_adapter
from app.services.event_broadcaster import broadcaster

def enqueue_and_send(
    db: Session,
    channel: str,
    recipient: str,
    subject: Optional[str],
    body: str,
    metadata: Optional[Dict[str, Any]] = None
) -> NotificationQueue:
    """
    Enqueues a notification record and dispatches it through the provider adapter (FR09).
    Updates delivery state atomically.
    """
    now = datetime.now(timezone.utc)
    notification = NotificationQueue(
        channel=channel.lower(),
        recipient=recipient.strip(),
        subject=subject,
        body=body,
        status="queued",
        attempts=0,
        error_message=None,
        created_at=now,
        sent_at=None
    )
    db.add(notification)
    db.commit()
    db.refresh(notification)

    # Attempt immediate dispatch
    try:
        notification.attempts += 1
        ch = channel.lower()
        if ch == "email":
            adapter = default_email_adapter
        elif ch == "sms":
            adapter = default_sms_adapter
        elif ch in ["print", "thermal_print"]:
            adapter = default_print_adapter
        else:
            adapter = default_email_adapter

        success = adapter.send(recipient=notification.recipient, subject=notification.subject, body=notification.body, metadata=metadata)
        if success:
            notification.status = "sent"
            notification.sent_at = datetime.now(timezone.utc)
            notification.error_message = None
        else:
            notification.status = "failed"
            notification.error_message = "Adapter returned failure code without exception."
    except Exception as e:
        notification.status = "failed"
        notification.error_message = str(e)

    db.commit()
    db.refresh(notification)

    # Notify SSE listeners
    broadcaster.broadcast("notification_dispatched", {
        "id": notification.id,
        "channel": notification.channel,
        "recipient": notification.recipient,
        "status": notification.status,
        "subject": notification.subject
    })

    return notification

def retry_failed_notification(db: Session, notification_id: int) -> NotificationQueue:
    """Retries dispatch of a previously failed notification (FR09)."""
    notification = db.query(NotificationQueue).filter(NotificationQueue.id == notification_id).first()
    if not notification:
        raise ValueError(f"Notification ID {notification_id} not found.")

    notification.attempts += 1
    try:
        ch = notification.channel.lower()
        if ch == "email":
            adapter = default_email_adapter
        elif ch == "sms":
            adapter = default_sms_adapter
        elif ch in ["print", "thermal_print"]:
            adapter = default_print_adapter
        else:
            adapter = default_email_adapter

        success = adapter.send(recipient=notification.recipient, subject=notification.subject, body=notification.body)
        if success:
            notification.status = "sent"
            notification.sent_at = datetime.now(timezone.utc)
            notification.error_message = None
        else:
            notification.status = "failed"
            notification.error_message = "Retry adapter returned failure."
    except Exception as e:
        notification.status = "failed"
        notification.error_message = str(e)

    db.commit()
    db.refresh(notification)
    return notification

def list_notifications(
    db: Session,
    channel: Optional[str] = None,
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 50
) -> List[NotificationQueue]:
    query = db.query(NotificationQueue)
    if channel:
        query = query.filter(NotificationQueue.channel == channel.lower())
    if status:
        query = query.filter(NotificationQueue.status == status.lower())
    return query.order_by(desc(NotificationQueue.id)).offset(skip).limit(limit).all()

def send_gate_alarm_email(
    db: Session,
    reader_id: str,
    accession_number: Optional[str],
    tag_uid: str,
    book_title: Optional[str],
    cctv_image_url: Optional[str]
) -> NotificationQueue:
    """Generates standard security alarm incident notification (FR07, FR09, AC06)."""
    recipient = "security-alerts@library.university.edu"
    subject = f"[CRITICAL ALARM] Unauthorized RFID Item Removal Detected - {reader_id}"
    body = (
        f"SECURITY INCIDENT ALERT - AISYS RFID SURVEILLANCE\n"
        f"--------------------------------------------------\n"
        f"Gate Sensor: {reader_id}\n"
        f"Event Time: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}\n"
        f"Accession Number: {accession_number or 'UNRESOLVED'}\n"
        f"Book Title: {book_title or 'Unknown Catalog Item'}\n"
        f"RFID Tag EPC: {tag_uid}\n"
        f"Security Bit: ARMED (EAS Violation)\n"
        f"CCTV Reference: {cctv_image_url or 'N/A'}\n\n"
        f"Action Required: Station officer dispatched to inspect pedestal."
    )
    return enqueue_and_send(
        db,
        channel="email",
        recipient=recipient,
        subject=subject,
        body=body,
        metadata={"tag_uid": tag_uid, "accession": accession_number, "cctv": cctv_image_url}
    )

def list_notifications(
    db: Session,
    status: Optional[str] = None,
    channel: Optional[str] = None,
    limit: int = 50,
    skip: int = 0
) -> List[NotificationQueue]:
    query = db.query(NotificationQueue)
    if status:
        query = query.filter(NotificationQueue.status == status.lower())
    if channel:
        query = query.filter(NotificationQueue.channel == channel.lower())
    return query.order_by(desc(NotificationQueue.id)).offset(skip).limit(limit).all()
