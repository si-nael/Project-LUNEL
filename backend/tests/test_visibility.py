"""Tests for visibility policy checking service."""
import uuid

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import (
    UserRole,
    GroupType,
    MembershipRole,
    VisibilityScopeType,
)
from app.models.user import User
from app.models.group import Group, GroupMembership
from app.models.visibility import VisibilityPolicy
from app.services.visibility import can_user_access


@pytest_asyncio.fixture
async def student(db_session: AsyncSession) -> User:
    user = User(
        id=uuid.uuid4(),
        email="vis_student@example.com",
        password_hash="fakehash",
        name="Vis Student",
        role=UserRole.STUDENT,
    )
    db_session.add(user)
    await db_session.flush()
    return user


@pytest_asyncio.fixture
async def teacher(db_session: AsyncSession) -> User:
    user = User(
        id=uuid.uuid4(),
        email="vis_teacher@example.com",
        password_hash="fakehash",
        name="Vis Teacher",
        role=UserRole.TEACHER,
    )
    db_session.add(user)
    await db_session.flush()
    return user


@pytest_asyncio.fixture
async def group_with_student(db_session: AsyncSession, student: User) -> Group:
    group = Group(
        id=uuid.uuid4(),
        name="Visibility Test Group",
        type=GroupType.CLUB,
        owner_user_id=student.id,
    )
    db_session.add(group)
    await db_session.flush()

    membership = GroupMembership(
        id=uuid.uuid4(),
        user_id=student.id,
        group_id=group.id,
        membership_role=MembershipRole.MEMBER,
    )
    db_session.add(membership)
    await db_session.flush()
    return group


@pytest.mark.asyncio
class TestCanUserAccess:
    async def test_no_policy_returns_true(self, db_session, student):
        result = await can_user_access(db_session, student, uuid.uuid4())
        assert result is True

    async def test_public_scope(self, db_session, student):
        policy = VisibilityPolicy(
            id=uuid.uuid4(),
            scope_type=VisibilityScopeType.PUBLIC,
        )
        db_session.add(policy)
        await db_session.flush()

        assert await can_user_access(db_session, student, policy.id) is True

    async def test_authenticated_scope(self, db_session, student):
        policy = VisibilityPolicy(
            id=uuid.uuid4(),
            scope_type=VisibilityScopeType.AUTHENTICATED,
        )
        db_session.add(policy)
        await db_session.flush()

        assert await can_user_access(db_session, student, policy.id) is True

    async def test_role_only_allowed(self, db_session, teacher):
        policy = VisibilityPolicy(
            id=uuid.uuid4(),
            scope_type=VisibilityScopeType.ROLE_ONLY,
            allow_role_names=["TEACHER", "ADMIN"],
        )
        db_session.add(policy)
        await db_session.flush()

        assert await can_user_access(db_session, teacher, policy.id) is True

    async def test_role_only_denied(self, db_session, student):
        policy = VisibilityPolicy(
            id=uuid.uuid4(),
            scope_type=VisibilityScopeType.ROLE_ONLY,
            allow_role_names=["TEACHER", "ADMIN"],
        )
        db_session.add(policy)
        await db_session.flush()

        assert await can_user_access(db_session, student, policy.id) is False

    async def test_group_only_member(self, db_session, student, group_with_student):
        policy = VisibilityPolicy(
            id=uuid.uuid4(),
            scope_type=VisibilityScopeType.GROUP_ONLY,
            allow_group_ids=[str(group_with_student.id)],
        )
        db_session.add(policy)
        await db_session.flush()

        assert await can_user_access(db_session, student, policy.id) is True

    async def test_group_only_non_member(self, db_session, teacher, group_with_student):
        policy = VisibilityPolicy(
            id=uuid.uuid4(),
            scope_type=VisibilityScopeType.GROUP_ONLY,
            allow_group_ids=[str(group_with_student.id)],
        )
        db_session.add(policy)
        await db_session.flush()

        assert await can_user_access(db_session, teacher, policy.id) is False

    async def test_group_and_role_both_match(self, db_session, student, group_with_student):
        policy = VisibilityPolicy(
            id=uuid.uuid4(),
            scope_type=VisibilityScopeType.GROUP_AND_ROLE,
            allow_group_ids=[str(group_with_student.id)],
            allow_role_names=["STUDENT"],
        )
        db_session.add(policy)
        await db_session.flush()

        assert await can_user_access(db_session, student, policy.id) is True

    async def test_group_and_role_role_mismatch(self, db_session, student, group_with_student):
        policy = VisibilityPolicy(
            id=uuid.uuid4(),
            scope_type=VisibilityScopeType.GROUP_AND_ROLE,
            allow_group_ids=[str(group_with_student.id)],
            allow_role_names=["TEACHER"],  # student won't match
        )
        db_session.add(policy)
        await db_session.flush()

        assert await can_user_access(db_session, student, policy.id) is False

    async def test_deny_group_blocks(self, db_session, student, group_with_student):
        policy = VisibilityPolicy(
            id=uuid.uuid4(),
            scope_type=VisibilityScopeType.GROUP_ONLY,
            allow_group_ids=[str(group_with_student.id)],
            deny_group_ids=[str(group_with_student.id)],  # also denied
        )
        db_session.add(policy)
        await db_session.flush()

        assert await can_user_access(db_session, student, policy.id) is False

    async def test_procedural_key_placeholder(self, db_session, student):
        policy = VisibilityPolicy(
            id=uuid.uuid4(),
            scope_type=VisibilityScopeType.PROCEDURAL_KEY,
        )
        db_session.add(policy)
        await db_session.flush()

        assert await can_user_access(db_session, student, policy.id) is False
