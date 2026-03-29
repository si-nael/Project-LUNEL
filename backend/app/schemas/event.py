from uuid import UUID
from datetime import datetime
from pydantic import BaseModel


class EventCreate(BaseModel):
    event_type: str
    title: str
    external_source_type: str | None = None
    external_source_id: str | None = None


class EventUpdate(BaseModel):
    title: str | None = None
    status: str | None = None


class EventResponse(BaseModel):
    id: UUID
    event_type: str
    title: str
    status: str
    external_source_type: str | None
    external_source_id: str | None
    result_sync_state: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class SyncJobResponse(BaseModel):
    id: UUID
    event_id: UUID
    job_type: str
    status: str
    result_summary: dict | None
    started_at: datetime | None
    completed_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}
