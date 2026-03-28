from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.models.enums import VisibilityScopeType


class VisibilityPolicyCreate(BaseModel):
    scope_type: VisibilityScopeType
    allow_public: bool = False
    allow_group_ids: list[UUID] | None = None
    allow_role_names: list[str] | None = None
    deny_group_ids: list[UUID] | None = None
    rule_expression_json: dict | None = None


class VisibilityPolicyResponse(BaseModel):
    id: UUID
    scope_type: VisibilityScopeType
    allow_public: bool
    allow_group_ids: list[UUID] | None
    allow_role_names: list[str] | None
    deny_group_ids: list[UUID] | None
    rule_expression_json: dict | None
    created_at: datetime

    model_config = {"from_attributes": True}
