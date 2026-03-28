from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.models.enums import ScheduleType, ScheduleSubtype, ScheduleStatus


class ScheduleCreate(BaseModel):
    title: str = Field(min_length=1, max_length=300)
    description: str | None = None
    type: ScheduleType
    subtype: ScheduleSubtype
    start_at: datetime
    end_at: datetime | None = None
    all_day: bool = False
    timezone: str = "Asia/Seoul"
    base_importance: int = Field(default=50, ge=1, le=100)
    authority_weight: int = Field(default=0, ge=0, le=30)
    visibility_policy_id: UUID | None = None
    project_id: UUID | None = None
    related_event_id: UUID | None = None
    location: str | None = None
    metadata: dict | None = None


class ScheduleUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=300)
    description: str | None = None
    start_at: datetime | None = None
    end_at: datetime | None = None
    all_day: bool | None = None
    status: ScheduleStatus | None = None
    base_importance: int | None = Field(default=None, ge=1, le=100)
    authority_weight: int | None = Field(default=None, ge=0, le=30)
    visibility_policy_id: UUID | None = None
    project_id: UUID | None = None
    related_event_id: UUID | None = None
    location: str | None = None
    metadata: dict | None = None


class ScheduleResponse(BaseModel):
    id: UUID
    title: str
    description: str | None
    type: ScheduleType
    subtype: ScheduleSubtype
    start_at: datetime
    end_at: datetime | None
    all_day: bool
    timezone: str
    status: ScheduleStatus
    importance_score: int
    base_importance: int
    authority_weight: int
    urgency_weight: int
    feedback_weight: int
    dependency_weight: int
    visibility_policy_id: UUID | None
    creator_id: UUID
    project_id: UUID | None
    related_event_id: UUID | None
    location: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ScheduleFilter(BaseModel):
    type: ScheduleType | None = None
    subtype: ScheduleSubtype | None = None
    group_id: UUID | None = None
    project_id: UUID | None = None
    visible_to_me: bool = True
    start_after: datetime | None = None
    end_before: datetime | None = None
    importance_min: int | None = None
    status: ScheduleStatus | None = None
