from uuid import UUID
from datetime import datetime
from pydantic import BaseModel


class HistoryResponse(BaseModel):
    id: UUID
    changed_by: UUID
    change_type: str
    previous_data: dict | None
    new_data: dict | None
    changed_at: datetime

    model_config = {"from_attributes": True}


class ScheduleHistoryResponse(HistoryResponse):
    schedule_id: UUID


class ProjectHistoryResponse(HistoryResponse):
    project_id: UUID


class TemporalQueryResponse(BaseModel):
    entity_id: UUID
    timestamp: datetime
    data: dict | None
