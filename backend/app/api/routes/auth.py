from __future__ import annotations

from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.config import get_settings
from app.core.database import get_db_session
from app.core.rate_limit import login_limiter
from app.core.security import create_access_token, hash_password, verify_password
from app.db.models import User
from app.schemas.auth import (
    LogoutResponse,
    MessageResponse,
    TokenResponse,
    UserLogin,
    UserRead,
    UserRegister,
    UserUpdate,
)

router = APIRouter(prefix="/auth", tags=["auth"])
settings = get_settings()


def _set_auth_cookie(response: Response, token: str, max_age: int) -> None:
    is_prod = settings.environment.lower() == "production"
    response.set_cookie(
        key="access_token",
        value=token,
        max_age=max_age,
        expires=max_age,
        httponly=True,
        samesite="lax",
        secure=is_prod,
        path="/",
    )


def _get_client_key(request: Request, email: str) -> str:
    host = request.client.host if request.client else "unknown"
    return f"{host}:{email.strip().lower()}"


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(
    payload: UserRegister,
    response: Response,
    session: AsyncSession = Depends(get_db_session),
) -> TokenResponse:
    email = payload.email.strip().lower()
    name = payload.name.strip()

    if payload.confirm_password is not None and payload.password != payload.confirm_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Passwords do not match",
        )

    # Check for duplicate email
    existing = await session.execute(select(User).where(User.email == email))
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email address already exists. Please sign in instead.",
        )

    user = User(
        name=name,
        email=email,
        hashed_password=hash_password(payload.password),
        role="researcher",
        is_active=True,
    )
    session.add(user)
    await session.commit()
    await session.refresh(user)

    expire_delta = timedelta(days=7)
    token = create_access_token(
        subject=user.id,
        extra_claims={"email": user.email, "name": user.name, "role": user.role},
        expires_delta=expire_delta,
    )

    # Set secure HttpOnly cookie
    _set_auth_cookie(response, token, max_age=int(expire_delta.total_seconds()))

    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=UserRead.model_validate(user),
    )


@router.post("/login", response_model=TokenResponse)
async def login(
    payload: UserLogin,
    request: Request,
    response: Response,
    session: AsyncSession = Depends(get_db_session),
) -> TokenResponse:
    email = payload.email.strip().lower()
    rate_key = _get_client_key(request, email)

    # Check rate limit lockout
    is_locked, remaining_lockout = login_limiter.is_locked(rate_key)
    if is_locked:
        minutes = max(1, remaining_lockout // 60)
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Too many failed login attempts. Account temporarily locked. Please try again in {minutes} minute(s).",
        )

    result = await session.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    if not user or not verify_password(payload.password, user.hashed_password):
        locked, remaining = login_limiter.record_failure(rate_key)
        if locked:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many failed login attempts. Account temporarily locked for 15 minutes.",
            )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password. Please verify your credentials.",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your operator account is currently deactivated. Please contact your system administrator.",
        )

    # Successful login: reset rate limiter for this user/IP
    login_limiter.clear(rate_key)

    if payload.remember_me:
        expire_delta = timedelta(days=30)
    else:
        expire_delta = timedelta(days=1)

    token = create_access_token(
        subject=user.id,
        extra_claims={"email": user.email, "name": user.name, "role": user.role},
        expires_delta=expire_delta,
    )

    # Set secure HttpOnly cookie
    _set_auth_cookie(response, token, max_age=int(expire_delta.total_seconds()))

    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=UserRead.model_validate(user),
    )


@router.post("/logout", response_model=LogoutResponse)
async def logout(response: Response) -> LogoutResponse:
    # Clear the HttpOnly session cookie
    response.delete_cookie(key="access_token", path="/")
    return LogoutResponse(detail="Logged out successfully")


@router.get("/me", response_model=UserRead)
async def get_me(current_user: User = Depends(get_current_user)) -> UserRead:
    return UserRead.model_validate(current_user)


@router.patch("/me", response_model=UserRead)
async def update_me(
    payload: UserUpdate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> UserRead:
    if payload.name is not None:
        clean_name = payload.name.strip()
        if len(clean_name) >= 2:
            current_user.name = clean_name
            session.add(current_user)
            await session.commit()
            await session.refresh(current_user)
    return UserRead.model_validate(current_user)


@router.post("/forgot-password", response_model=MessageResponse)
async def forgot_password() -> MessageResponse:
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Email delivery (SMTP) is not configured in this environment. Self-hosted administrators should reset passwords directly via the database or CLI.",
    )
