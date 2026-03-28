from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class RatingCreate(BaseModel):
    score: int = Field(ge=1, le=5)
    usefulness_score: int | None = Field(default=None, ge=1, le=5)
    importance_feedback: int | None = Field(default=None, ge=1, le=5)
    comment: str | None = None


class RatingResponse(BaseModel):
    id: UUID
    schedule_id: UUID
    user_id: UUID
    score: int
    usefulness_score: int | None
    importance_feedback: int | None
    comment: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class RatingSummary(BaseModel):
    schedule_id: UUID
    total_ratings: int
    avg_score: float
    avg_usefulness: float | None
    avg_importance_feedback: float | None
