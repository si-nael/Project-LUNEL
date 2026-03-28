from uuid import UUID
from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel


class CompetitionCreate(BaseModel):
    event_id: UUID
    max_participants: int | None = None
    scoring_rule: dict | None = None


class CompetitionResponse(BaseModel):
    id: UUID
    event_id: UUID
    max_participants: int | None
    scoring_rule: dict | None
    created_at: datetime

    model_config = {"from_attributes": True}


class ParticipantResponse(BaseModel):
    id: UUID
    competition_id: UUID
    user_id: UUID
    registered_at: datetime
    status: str

    model_config = {"from_attributes": True}


class SubmissionCreate(BaseModel):
    content: dict | None = None


class SubmissionResponse(BaseModel):
    id: UUID
    competition_id: UUID
    participant_id: UUID
    content: dict | None
    score: Decimal | None
    submitted_at: datetime
    graded_at: datetime | None

    model_config = {"from_attributes": True}


class GradeSubmission(BaseModel):
    score: Decimal


class ScoreboardResponse(BaseModel):
    id: UUID
    competition_id: UUID
    snapshot_data: dict
    is_final: bool
    created_at: datetime

    model_config = {"from_attributes": True}
