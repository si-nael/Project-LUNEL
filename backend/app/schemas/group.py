from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.models.enums import GroupType, MembershipRole


class GroupCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    type: GroupType
    is_temporary: bool = False
    expires_at: datetime | None = None


class GroupResponse(BaseModel):
    id: UUID
    name: str
    type: GroupType
    owner_user_id: UUID
    is_temporary: bool
    expires_at: datetime | None
    is_active: bool
    created_at: datetime
    member_count: int = 0

    model_config = {"from_attributes": True}


class GroupMemberAdd(BaseModel):
    user_id: UUID
    membership_role: MembershipRole = MembershipRole.MEMBER
    expires_at: datetime | None = None


class GroupMemberResponse(BaseModel):
    id: UUID
    user_id: UUID
    user_name: str = ""
    group_id: UUID
    membership_role: MembershipRole
    joined_at: datetime
    expires_at: datetime | None

    model_config = {"from_attributes": True}
