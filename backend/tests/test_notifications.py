"""Tests for Phase 2: Notifications API."""
import uuid

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notification import Notification
from app.models.user import User
from tests.conftest import auth_header


@pytest_asyncio.fixture
async def notifications(db_session: AsyncSession, test_user: User):
    notifs = []
    for i in range(3):
        n = Notification(
            id=uuid.uuid4(),
            user_id=test_user.id,
            type="DEADLINE",
            title=f"Notification {i}",
            body=f"Body {i}",
            is_read=(i == 0),  # first one is read
        )
        db_session.add(n)
        notifs.append(n)
    await db_session.flush()
    for n in notifs:
        await db_session.refresh(n)
    return notifs


@pytest.mark.asyncio
class TestNotifications:
    async def test_list_all(
        self, client: AsyncClient, test_user: User, notifications
    ):
        resp = await client.get(
            "/api/v1/notifications",
            headers=auth_header(test_user),
        )
        assert resp.status_code == 200
        assert len(resp.json()) == 3

    async def test_list_unread_only(
        self, client: AsyncClient, test_user: User, notifications
    ):
        resp = await client.get(
            "/api/v1/notifications?unread_only=true",
            headers=auth_header(test_user),
        )
        assert resp.status_code == 200
        assert len(resp.json()) == 2

    async def test_unread_count(
        self, client: AsyncClient, test_user: User, notifications
    ):
        resp = await client.get(
            "/api/v1/notifications/unread-count",
            headers=auth_header(test_user),
        )
        assert resp.status_code == 200
        assert resp.json()["unread_count"] == 2

    async def test_mark_read(
        self, client: AsyncClient, test_user: User, notifications
    ):
        unread_id = str(notifications[1].id)
        resp = await client.patch(
            f"/api/v1/notifications/{unread_id}/read",
            headers=auth_header(test_user),
        )
        assert resp.status_code == 200
        assert resp.json()["is_read"] is True

    async def test_mark_all_read(
        self, client: AsyncClient, test_user: User, notifications
    ):
        resp = await client.post(
            "/api/v1/notifications/read-all",
            headers=auth_header(test_user),
        )
        assert resp.status_code == 204

        # Verify all are read
        count_resp = await client.get(
            "/api/v1/notifications/unread-count",
            headers=auth_header(test_user),
        )
        assert count_resp.json()["unread_count"] == 0

    async def test_other_user_cannot_read_notification(
        self, client: AsyncClient, admin_user: User, notifications
    ):
        notif_id = str(notifications[0].id)
        resp = await client.patch(
            f"/api/v1/notifications/{notif_id}/read",
            headers=auth_header(admin_user),
        )
        assert resp.status_code == 404
