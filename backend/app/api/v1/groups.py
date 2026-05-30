from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func as sa_func
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.deps import get_current_user
from app.auth.m2m import require_m2m_proof
from app.database import get_db
from app.models.group import Group, GroupMembership
from app.models.user import User
from app.models.enums import MembershipRole
from app.schemas.group import (
    GroupCreate,
    GroupMemberAdd,
    GroupMemberResponse,
    GroupResponse,
)

router = APIRouter()


@router.post("", response_model=GroupResponse, status_code=status.HTTP_201_CREATED)
async def create_group(
    data: GroupCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    group = Group(
        name=data.name,
        type=data.type,
        owner_user_id=current_user.id,
        is_temporary=data.is_temporary,
        expires_at=data.expires_at,
        visibility_policy_id=data.visibility_policy_id,
    )
    db.add(group)
    await db.flush()

    # Auto-add creator as OWNER
    membership = GroupMembership(
        user_id=current_user.id,
        group_id=group.id,
        membership_role=MembershipRole.OWNER,
    )
    db.add(membership)
    await db.flush()
    await db.refresh(group)

    return GroupResponse(
        id=group.id,
        name=group.name,
        type=group.type,
        owner_user_id=group.owner_user_id,
        is_temporary=group.is_temporary,
        expires_at=group.expires_at,
        is_active=group.is_active,
        created_at=group.created_at,
        visibility_policy_id=group.visibility_policy_id,
        member_count=1,
    )


@router.get("", response_model=list[GroupResponse])
async def list_groups(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = (
        select(
            Group,
            sa_func.count(GroupMembership.id).label("member_count"),
        )
        .outerjoin(GroupMembership, Group.id == GroupMembership.group_id)
        .where(Group.is_active.is_(True))
        .group_by(Group.id)
    )
    result = await db.execute(stmt)
    rows = result.all()

    return [
        GroupResponse(
            id=g.id,
            name=g.name,
            type=g.type,
            owner_user_id=g.owner_user_id,
            is_temporary=g.is_temporary,
            expires_at=g.expires_at,
            is_active=g.is_active,
            created_at=g.created_at,
            visibility_policy_id=g.visibility_policy_id,
            member_count=cnt,
        )
        for g, cnt in rows
    ]


@router.get("/secret", response_model=list[GroupResponse])
async def list_secret_groups(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    m2m_verified_user: User = Depends(require_m2m_proof),
):
    stmt = (
        select(
            Group,
            sa_func.count(GroupMembership.id).label("member_count"),
        )
        .outerjoin(GroupMembership, Group.id == GroupMembership.group_id)
        .where(Group.is_active.is_(True), Group.visibility_policy_id.is_not(None))
        .group_by(Group.id)
    )
    result = await db.execute(stmt)
    rows = result.all()

    return [
        GroupResponse(
            id=g.id,
            name=g.name,
            type=g.type,
            owner_user_id=g.owner_user_id,
            is_temporary=g.is_temporary,
            expires_at=g.expires_at,
            is_active=g.is_active,
            created_at=g.created_at,
            visibility_policy_id=g.visibility_policy_id,
            member_count=cnt,
        )
        for g, cnt in rows
    ]


@router.get("/{group_id}", response_model=GroupResponse)
async def get_group(
    group_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = (
        select(
            Group,
            sa_func.count(GroupMembership.id).label("member_count"),
        )
        .outerjoin(GroupMembership, Group.id == GroupMembership.group_id)
        .where(Group.id == group_id)
        .group_by(Group.id)
    )
    result = await db.execute(stmt)
    row = result.one_or_none()

    if row is None:
        raise HTTPException(status_code=404, detail="Group not found")

    g, cnt = row
    return GroupResponse(
        id=g.id,
        name=g.name,
        type=g.type,
        owner_user_id=g.owner_user_id,
        is_temporary=g.is_temporary,
        expires_at=g.expires_at,
        is_active=g.is_active,
        created_at=g.created_at,
        visibility_policy_id=g.visibility_policy_id,
        member_count=cnt,
    )


@router.post("/{group_id}/members", response_model=GroupMemberResponse, status_code=status.HTTP_201_CREATED)
async def add_member(
    group_id: UUID,
    data: GroupMemberAdd,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Verify group exists
    group = await db.get(Group, group_id)
    if group is None:
        raise HTTPException(status_code=404, detail="Group not found")

    # Check if requester has permission (owner or admin)
    result = await db.execute(
        select(GroupMembership).where(
            GroupMembership.group_id == group_id,
            GroupMembership.user_id == current_user.id,
            GroupMembership.membership_role.in_([MembershipRole.OWNER, MembershipRole.ADMIN]),
        )
    )
    if result.scalar_one_or_none() is None:
        raise HTTPException(status_code=403, detail="Not authorized to add members")

    # Verify target user exists
    target_user = await db.get(User, data.user_id)
    if target_user is None:
        raise HTTPException(status_code=404, detail="User not found")

    # Check duplicate
    result = await db.execute(
        select(GroupMembership).where(
            GroupMembership.group_id == group_id,
            GroupMembership.user_id == data.user_id,
        )
    )
    if result.scalar_one_or_none() is not None:
        raise HTTPException(status_code=409, detail="User already a member")

    membership = GroupMembership(
        user_id=data.user_id,
        group_id=group_id,
        membership_role=data.membership_role,
        expires_at=data.expires_at,
    )
    db.add(membership)
    await db.flush()
    await db.refresh(membership)

    return GroupMemberResponse(
        id=membership.id,
        user_id=membership.user_id,
        user_name=target_user.name,
        group_id=membership.group_id,
        membership_role=membership.membership_role,
        joined_at=membership.joined_at,
        expires_at=membership.expires_at,
    )


@router.delete("/{group_id}/members/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_member(
    group_id: UUID,
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Check permission
    result = await db.execute(
        select(GroupMembership).where(
            GroupMembership.group_id == group_id,
            GroupMembership.user_id == current_user.id,
            GroupMembership.membership_role.in_([MembershipRole.OWNER, MembershipRole.ADMIN]),
        )
    )
    if result.scalar_one_or_none() is None and current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")

    result = await db.execute(
        select(GroupMembership).where(
            GroupMembership.group_id == group_id,
            GroupMembership.user_id == user_id,
        )
    )
    membership = result.scalar_one_or_none()
    if membership is None:
        raise HTTPException(status_code=404, detail="Membership not found")

    await db.delete(membership)


@router.post("/{group_id}/join-via-challenge", response_model=GroupMemberResponse, status_code=status.HTTP_201_CREATED)
async def join_via_challenge(
    group_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from app.services.procedural_key import has_verified_challenge
    
    # Verify group exists
    group = await db.get(Group, group_id)
    if group is None:
        raise HTTPException(status_code=404, detail="Group not found")

    if not group.visibility_policy_id:
        raise HTTPException(status_code=400, detail="This group does not require a challenge")

    # Check if user passed challenge
    passed = await has_verified_challenge(db, group.visibility_policy_id, current_user.id)
    if not passed:
        raise HTTPException(status_code=403, detail="You must pass the procedural challenge first")

    # Check duplicate
    result = await db.execute(
        select(GroupMembership).where(
            GroupMembership.group_id == group_id,
            GroupMembership.user_id == current_user.id,
        )
    )
    if result.scalar_one_or_none() is not None:
        raise HTTPException(status_code=409, detail="User already a member")

    membership = GroupMembership(
        user_id=current_user.id,
        group_id=group_id,
        membership_role=MembershipRole.MEMBER,
    )
    db.add(membership)
    await db.flush()
    await db.refresh(membership)

    return GroupMemberResponse(
        id=membership.id,
        user_id=membership.user_id,
        user_name=current_user.name,
        group_id=membership.group_id,
        membership_role=membership.membership_role,
        joined_at=membership.joined_at,
        expires_at=membership.expires_at,
    )
