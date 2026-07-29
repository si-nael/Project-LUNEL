from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, Field


class ActivityNodeCreate(BaseModel):
    parent_id: UUID | None = None
    related_schedule_id: UUID | None = None
    assigned_user_id: UUID | None = None
    node_type: str
    title: str
    order_index: int = 0
    available_at: datetime | None = None
    due_at: datetime | None = None
    cost_hours: float = 0.0
    success_probability: float = 1.0
    reward_points: float = 0.0


class ActivityNodeUpdate(BaseModel):
    title: str | None = None
    status: str | None = None
    assigned_user_id: UUID | None = None
    progress: int | None = Field(None, ge=0, le=100)
    order_index: int | None = None
    available_at: datetime | None = None
    due_at: datetime | None = None
    cost_hours: float | None = None
    success_probability: float | None = Field(None, ge=0.0, le=1.0)
    reward_points: float | None = None


class ActivityNodeResponse(BaseModel):
    id: UUID
    project_id: UUID
    parent_id: UUID | None
    related_schedule_id: UUID | None
    assigned_user_id: UUID | None
    node_type: str
    title: str
    status: str
    progress: int
    order_index: int
    cost_hours: float
    success_probability: float
    reward_points: float
    available_at: datetime | None
    due_at: datetime | None
    completed_at: datetime | None
    version: int
    created_at: datetime

    model_config = {"from_attributes": True}


class ActivityEdgeCreate(BaseModel):
    from_node_id: UUID
    to_node_id: UUID
    edge_type: str


class ActivityEdgeResponse(BaseModel):
    id: UUID
    from_node_id: UUID
    to_node_id: UUID
    edge_type: str

    model_config = {"from_attributes": True}
