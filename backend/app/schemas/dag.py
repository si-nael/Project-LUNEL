from uuid import UUID
from datetime import datetime
from pydantic import BaseModel


class DAGOrderResponse(BaseModel):
    project_id: UUID
    ordered_node_ids: list[UUID]


class DAGLayerResponse(BaseModel):
    project_id: UUID
    layers: list[list[UUID]]


class CycleCheckResponse(BaseModel):
    project_id: UUID
    has_cycle: bool
