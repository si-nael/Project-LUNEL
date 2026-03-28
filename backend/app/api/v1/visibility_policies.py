from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.deps import get_current_user
from app.database import get_db
from app.models.visibility import VisibilityPolicy
from app.models.user import User
from app.schemas.visibility import VisibilityPolicyCreate, VisibilityPolicyResponse

router = APIRouter()


@router.post("", response_model=VisibilityPolicyResponse, status_code=status.HTTP_201_CREATED)
async def create_policy(
    data: VisibilityPolicyCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    policy = VisibilityPolicy(
        scope_type=data.scope_type,
        allow_public=data.allow_public,
        allow_group_ids=[str(gid) for gid in data.allow_group_ids] if data.allow_group_ids else None,
        allow_role_names=data.allow_role_names,
        deny_group_ids=[str(gid) for gid in data.deny_group_ids] if data.deny_group_ids else None,
        rule_expression_json=data.rule_expression_json,
    )
    db.add(policy)
    await db.flush()
    await db.refresh(policy)
    return policy


@router.get("/{policy_id}", response_model=VisibilityPolicyResponse)
async def get_policy(
    policy_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    policy = await db.get(VisibilityPolicy, policy_id)
    if policy is None:
        raise HTTPException(status_code=404, detail="Policy not found")
    return policy
