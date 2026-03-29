from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.deps import get_current_user
from app.database import get_db
from app.models.user import User
from app.schemas.challenge import (
    ChallengeCreate, ChallengeResponse,
    ChallengeVerifyRequest, ChallengeVerifyResponse,
)
from app.services.procedural_key import create_challenge, verify_challenge

router = APIRouter()


@router.post(
    "",
    response_model=ChallengeResponse,
    status_code=status.HTTP_201_CREATED,
)
async def request_challenge(
    data: ChallengeCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    challenge = await create_challenge(
        db,
        policy_id=data.visibility_policy_id,
        user_id=current_user.id,
        challenge_type=data.challenge_type,
    )
    return challenge


@router.post(
    "/{challenge_id}/verify",
    response_model=ChallengeVerifyResponse,
)
async def verify(
    challenge_id: UUID,
    data: ChallengeVerifyRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    success, message = await verify_challenge(db, challenge_id, data.answer)
    if not success:
        raise HTTPException(status_code=400, detail=message)
    return ChallengeVerifyResponse(success=True, message=message)
