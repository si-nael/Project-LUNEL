"""Tests for Phase 2 services: notification triggers, temp group lifecycle."""
import uuid
from datetime import datetime, timezone, timedelta

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import UserRole, GroupType, ScheduleType, ScheduleStatus
from app.models.user import User
from app.models.group import Group
from app.models.schedule import Schedule
from app.services.notifications import (
    create_notification,
    notify_deadline_approaching,
    notify_schedule_changed,
    notify_rating_received,
    notify_group_invite,
    notify_result_confirmed,
)
from app.services.group_lifecycle import deactivate_expired_groups


@pytest_asyncio.fixture
async def schedule_fixture(db_session: AsyncSession, test_user: User):
    schedule = Schedule(
        id=uuid.uuid4(),
        title="Test Schedule",
        type=ScheduleType.EVENT,
        subtype="GENERAL_EVENT",
        start_at=datetime.now(timezone.utc) + timedelta(hours=12),
        status=ScheduleStatus.SCHEDULED,
        creator_id=test_user.id,
    )
    db_session.add(schedule)
    await db_session.flush()
    await db_session.refresh(schedule)
    return schedule


@pytest.mark.asyncio
class TestNotificationService:
    async def test_create_notification(
        self, db_session: AsyncSession, test_user: User
    ):
        notif = await create_notification(
            db_session,
            user_id=test_user.id,
            type="TEST",
            title="Test Notification",
            body="This is a test.",
        )
        assert notif.id is not None
        assert notif.user_id == test_user.id
        assert notif.is_read is False

    async def test_notify_deadline_approaching(
        self, db_session: AsyncSession, test_user: User, schedule_fixture
    ):
        notifs = await notify_deadline_approaching(
            db_session, schedule_fixture, hours_before=24
        )
        assert len(notifs) == 1
        assert notifs[0].type == "DEADLINE"
        assert "마감 임박" in notifs[0].title
        assert notifs[0].related_schedule_id == schedule_fixture.id

    async def test_notify_schedule_changed_different_user(
        self, db_session: AsyncSession, test_user: User, admin_user: User, schedule_fixture
    ):
        notifs = await notify_schedule_changed(
            db_session, schedule_fixture, changed_by=admin_user.id
        )
        assert len(notifs) == 1
        assert notifs[0].type == "SCHEDULE_CHANGE"

    async def test_notify_schedule_changed_self_no_notification(
        self, db_session: AsyncSession, test_user: User, schedule_fixture
    ):
        notifs = await notify_schedule_changed(
            db_session, schedule_fixture, changed_by=test_user.id
        )
        assert len(notifs) == 0

    async def test_notify_rating_received(
        self, db_session: AsyncSession, test_user: User, schedule_fixture
    ):
        notifs = await notify_rating_received(
            db_session, schedule_fixture, rater_name="김학생"
        )
        assert len(notifs) == 1
        assert "김학생" in notifs[0].body

    async def test_notify_group_invite(
        self, db_session: AsyncSession, test_user: User
    ):
        notif = await notify_group_invite(
            db_session, user_id=test_user.id, group_name="코딩 동아리"
        )
        assert notif.type == "GROUP_INVITE"
        assert "코딩 동아리" in notif.title

    async def test_notify_result_confirmed(
        self, db_session: AsyncSession, test_user: User
    ):
        notif = await notify_result_confirmed(
            db_session, user_id=test_user.id, event_title="수학 올림피아드"
        )
        assert notif.type == "RESULT_CONFIRMED"
        assert "수학 올림피아드" in notif.title


@pytest.mark.asyncio
class TestGroupLifecycle:
    async def test_deactivate_expired_groups(self, db_session: AsyncSession, test_user: User):
        # Create an expired temp group
        expired_group = Group(
            id=uuid.uuid4(),
            name="Expired Team",
            type=GroupType.TEMPORARY,
            owner_user_id=test_user.id,
            is_temporary=True,
            is_active=True,
            expires_at=datetime.now(timezone.utc) - timedelta(hours=1),
        )
        db_session.add(expired_group)

        # Create a non-expired temp group
        active_group = Group(
            id=uuid.uuid4(),
            name="Active Team",
            type=GroupType.TEMPORARY,
            owner_user_id=test_user.id,
            is_temporary=True,
            is_active=True,
            expires_at=datetime.now(timezone.utc) + timedelta(days=7),
        )
        db_session.add(active_group)
        await db_session.flush()

        count = await deactivate_expired_groups(db_session)
        assert count == 1

        await db_session.refresh(expired_group)
        await db_session.refresh(active_group)
        assert expired_group.is_active is False
        assert active_group.is_active is True

    async def test_no_expired_groups(self, db_session: AsyncSession):
        count = await deactivate_expired_groups(db_session)
        assert count == 0
