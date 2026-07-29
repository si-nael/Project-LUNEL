from uuid import UUID
from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel


class CompetitionCreate(BaseModel):
    event_id: UUID
    max_participants: int | None = None
    scoring_rule: dict | None = None
    opens_at: datetime | None = None
    closes_at: datetime | None = None
    freeze_at: datetime | None = None
    scoreboard_public: bool = True


class CompetitionUpdate(BaseModel):
    max_participants: int | None = None
    scoring_rule: dict | None = None
    opens_at: datetime | None = None
    closes_at: datetime | None = None
    freeze_at: datetime | None = None
    scoreboard_public: bool | None = None


class CompetitionResponse(BaseModel):
    id: UUID
    event_id: UUID
    max_participants: int | None
    scoring_rule: dict | None
    opens_at: datetime | None
    closes_at: datetime | None
    freeze_at: datetime | None
    scoreboard_public: bool
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
    competition_problem_id: UUID | None = None
    language: str | None = None
    source_code: str | None = None


class SubmissionResponse(BaseModel):
    id: UUID
    competition_id: UUID
    participant_id: UUID
    competition_problem_id: UUID | None
    content: dict | None
    language: str | None
    source_code: str | None
    verdict: str
    score: Decimal | None
    penalty: int
    execution_time_ms: int | None
    memory_kb: int | None
    judge_message: str | None
    result_detail: dict | None
    submitted_at: datetime
    graded_at: datetime | None
    judged_at: datetime | None

    model_config = {"from_attributes": True}


class GradeSubmission(BaseModel):
    score: Decimal


class JudgeSubmission(BaseModel):
    verdict: str
    score: Decimal | None = None
    penalty: int = 0
    execution_time_ms: int | None = None
    memory_kb: int | None = None
    judge_message: str | None = None
    result_detail: dict | None = None


class ScoreboardResponse(BaseModel):
    id: UUID
    competition_id: UUID
    snapshot_data: dict
    is_final: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class CompetitionListItem(BaseModel):
    id: UUID
    event_id: UUID
    title: str
    event_status: str
    max_participants: int | None
    participant_count: int
    problem_count: int
    scoring_rule: dict | None
    opens_at: datetime | None
    closes_at: datetime | None
    freeze_at: datetime | None
    scoreboard_public: bool
    created_at: datetime
