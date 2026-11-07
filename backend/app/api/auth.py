from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import verify_password, create_access_token, get_current_user
from app.models.user import User, Role
from app.schemas.auth import LoginRequest, SmartCardLoginRequest, Token, UserOut
from app.services.audit_service import log_audit_event

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/login", response_model=Token)
def login(request: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == request.username.strip()).first()
    if not user or not verify_password(request.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password"
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is deactivated"
        )

    access_token = create_access_token(
        data={"sub": user.username, "role": user.role.name, "user_id": user.id}
    )
    
    log_audit_event(
        db,
        action="USER_LOGIN_PASSWORD",
        resource_type="user",
        resource_id=str(user.id),
        actor_user_id=user.id,
        details={"username": user.username, "role": user.role.name}
    )
    db.commit()

    user_out = UserOut(
        id=user.id,
        username=user.username,
        email=user.email,
        full_name=user.full_name,
        role_id=user.role_id,
        role_name=user.role.name if user.role else None,
        smart_card_uid=user.smart_card_uid,
        is_active=user.is_active,
        created_at=user.created_at
    )
    return Token(access_token=access_token, token_type="bearer", user=user_out)

@router.post("/smartcard-login", response_model=Token)
def smartcard_login(request: SmartCardLoginRequest, db: Session = Depends(get_db)):
    card_uid = request.smart_card_uid.strip().upper()
    user = db.query(User).filter(User.smart_card_uid == card_uid).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"No staff account bound to smart card UID '{card_uid}'"
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is deactivated"
        )

    access_token = create_access_token(
        data={"sub": user.username, "role": user.role.name, "user_id": user.id}
    )

    log_audit_event(
        db,
        action="USER_LOGIN_SMARTCARD",
        resource_type="user",
        resource_id=str(user.id),
        actor_user_id=user.id,
        details={"smart_card_uid": card_uid, "username": user.username, "role": user.role.name}
    )
    db.commit()

    user_out = UserOut(
        id=user.id,
        username=user.username,
        email=user.email,
        full_name=user.full_name,
        role_id=user.role_id,
        role_name=user.role.name if user.role else None,
        smart_card_uid=user.smart_card_uid,
        is_active=user.is_active,
        created_at=user.created_at
    )
    return Token(access_token=access_token, token_type="bearer", user=user_out)

@router.get("/me", response_model=UserOut)
def get_current_user_profile(user: User = Depends(get_current_user)):
    return UserOut(
        id=user.id,
        username=user.username,
        email=user.email,
        full_name=user.full_name,
        role_id=user.role_id,
        role_name=user.role.name if user.role else None,
        smart_card_uid=user.smart_card_uid,
        is_active=user.is_active,
        created_at=user.created_at
    )
