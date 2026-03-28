from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.models.enums import ProjectStatus


class ProjectCreate(BaseModel):
    title: str = Field(min_length=1, max_length=300)
    description: str | None = None
    owner_group_id: UUID
    status: ProjectStatus = ProjectStatus.DRAFT
    visibility_policy_id: UUID | None = None


class ProjectUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=300)
    description: str | None = None
    progress_percent: int | None = Field(default=None, ge=0, le=100)
    status: ProjectStatus | None = None
    visibility_policy_id: UUID | None = None


class ProjectResponse(BaseModel):
    id: UUID
    title: str
    description: str | None
    owner_group_id: UUID
    progress_percent: int
    status: ProjectStatus
    visibility_policy_id: UUID | None
    created_by: UUID
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
