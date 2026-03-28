from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.group import GroupMembership
from app.models.user import User
from app.models.visibility import VisibilityPolicy
from app.models.enums import VisibilityScopeType


async def can_user_access(
    db: AsyncSession, user: User, policy_id: UUID
) -> bool:
    policy = await db.get(VisibilityPolicy, policy_id)
    if policy is None:
        return True

    scope = policy.scope_type

    if scope == VisibilityScopeType.PUBLIC:
        return True

    if scope == VisibilityScopeType.AUTHENTICATED:
        return True  # user is already authenticated if we reach here

    if scope == VisibilityScopeType.ROLE_ONLY:
        if policy.allow_role_names and user.role.value in policy.allow_role_names:
            return True
        return False

    if scope in (VisibilityScopeType.GROUP_ONLY, VisibilityScopeType.GROUP_AND_ROLE):
        # Check group membership
        user_in_allowed_group = False
        if policy.allow_group_ids:
            group_ids = [UUID(str(gid)) for gid in policy.allow_group_ids]
            result = await db.execute(
                select(GroupMembership).where(
                    GroupMembership.user_id == user.id,
                    GroupMembership.group_id.in_(group_ids),
                )
            )
            user_in_allowed_group = result.scalar_one_or_none() is not None

        # Check denied groups
        if policy.deny_group_ids:
            deny_ids = [UUID(str(gid)) for gid in policy.deny_group_ids]
            result = await db.execute(
                select(GroupMembership).where(
                    GroupMembership.user_id == user.id,
                    GroupMembership.group_id.in_(deny_ids),
                )
            )
            if result.scalar_one_or_none() is not None:
                return False

        if scope == VisibilityScopeType.GROUP_ONLY:
            return user_in_allowed_group

        if scope == VisibilityScopeType.GROUP_AND_ROLE:
            role_ok = (
                policy.allow_role_names
                and user.role.value in policy.allow_role_names
            )
            return user_in_allowed_group and role_ok

    if scope == VisibilityScopeType.PROCEDURAL_KEY:
        # v1: placeholder — will be implemented in Phase 3
        return False

    return False
