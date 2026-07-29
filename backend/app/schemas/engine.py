from uuid import UUID

from pydantic import BaseModel, Field


class NodeTransitionRequest(BaseModel):
    target_status: str
    expected_version: int | None = Field(None, ge=1)


class WorkflowProjectionResponse(BaseModel):
    project_id: UUID
    generated_at: str
    summary: dict
    nodes: list[dict]
    edges: list[dict]
