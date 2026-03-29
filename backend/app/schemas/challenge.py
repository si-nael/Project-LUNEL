from uuid import UUID
from datetime import datetime
from pydantic import BaseModel


class ChallengeCreate(BaseModel):
    visibility_policy_id: UUID
    challenge_type: str = "auto"  # "auto", "math", "text"


class ChallengeResponse(BaseModel):
    id: UUID
    visibility_policy_id: UUID
    user_id: UUID
    challenge_type: str
    challenge_data: dict
    status: str
    attempts: int
    max_attempts: int
    expires_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


class ChallengeVerifyRequest(BaseModel):
    answer: str


class ChallengeVerifyResponse(BaseModel):
    success: bool
    message: str
