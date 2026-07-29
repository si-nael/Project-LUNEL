from uuid import UUID as PyUUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.database import get_db
from app.models.user import User
from app.schemas.user import (
    TokenRefresh,
    TokenResponse,
    UserCreate,
    UserLogin,
    UserResponse,
    LogoutRequest,
)
from fastapi.security import HTTPAuthorizationCredentials
from app.auth.deps import security_scheme
from app.services.token_blocklist import block_token, is_token_blocked

router = APIRouter()


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(data: UserCreate, db: AsyncSession = Depends(get_db)):
    if data.role.value not in ("STUDENT", "EXTERNAL"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="교사·관리자 계정은 관리자가 별도로 부여해야 합니다.",
        )
    result = await db.execute(select(User).where(User.email == data.email))
    if result.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )

    user = User(
        email=data.email,
        password_hash=hash_password(data.password),
        name=data.name,
        role=data.role,
        class_info=data.class_info,
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)
    return user


@router.post("/login", response_model=TokenResponse)
async def login(data: UserLogin, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalar_one_or_none()

    if user is None or not verify_password(data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated",
        )

    return TokenResponse(
        access_token=create_access_token(user.id, user.role.value),
        refresh_token=create_refresh_token(user.id),
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(data: TokenRefresh, db: AsyncSession = Depends(get_db)):
    payload = decode_token(data.refresh_token)
    if payload is None or payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        )

    if await is_token_blocked(data.refresh_token):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has been logged out",
        )

    user_id = payload.get("sub")
    result = await db.execute(select(User).where(User.id == PyUUID(user_id)))
    user = result.scalar_one_or_none()

    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
        )

    return TokenResponse(
        access_token=create_access_token(user.id, user.role.value),
        refresh_token=create_refresh_token(user.id),
    )


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    data: LogoutRequest,
    credentials: HTTPAuthorizationCredentials = Depends(security_scheme)
):
    from datetime import datetime, timezone
    
    # Block access token
    access_payload = decode_token(credentials.credentials)
    if access_payload and "exp" in access_payload:
        exp = datetime.fromtimestamp(access_payload["exp"], tz=timezone.utc)
        await block_token(credentials.credentials, exp)
            
    # Block refresh token
    if data.refresh_token:
        refresh_payload = decode_token(data.refresh_token)
        if refresh_payload and "exp" in refresh_payload:
            exp = datetime.fromtimestamp(refresh_payload["exp"], tz=timezone.utc)
            await block_token(data.refresh_token, exp)
