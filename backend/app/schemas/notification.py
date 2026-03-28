from uuid import UUID
from datetime import datetime
from pydantic import BaseModel


class NotificationResponse(BaseModel):
    id: UUID
    user_id: UUID
    type: str
    title: str
    body: str | None
    related_schedule_id: UUID | None
    related_project_id: UUID | None
    is_read: bool
    created_at: datetime

    model_config = {"from_attributes": True}
