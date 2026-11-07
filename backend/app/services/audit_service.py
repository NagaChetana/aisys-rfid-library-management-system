import json
from typing import Optional, Any
from sqlalchemy.orm import Session
from app.models.audit import AuditLog

def log_audit_event(
    db: Session,
    action: str,
    resource_type: str,
    resource_id: Optional[str] = None,
    actor_user_id: Optional[int] = None,
    details: Optional[Any] = None,
    ip_address: Optional[str] = "127.0.0.1"
) -> AuditLog:
    """Record an immutable audit log entry."""
    details_str = json.dumps(details, default=str) if isinstance(details, (dict, list)) else (str(details) if details else None)
    
    audit_entry = AuditLog(
        actor_user_id=actor_user_id,
        action=action,
        resource_type=resource_type,
        resource_id=str(resource_id) if resource_id is not None else None,
        details=details_str,
        ip_address=ip_address
    )
    db.add(audit_entry)
    db.flush()
    return audit_entry
