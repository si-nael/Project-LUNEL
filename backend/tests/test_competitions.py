"""Tests for Phase 2: Competition / Submission / Scoreboard API."""
import uuid

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import EventType, EventStatus, GroupType, MembershipRole
from app.models.event import Event
from app.models.group import Group, GroupMembership
from app.models.user import User
from tests.conftest import auth_header


@pytest_asyncio.fixture
async def test_event(db_session: AsyncSession):
    event = Event(
        id=uuid.uuid4(),
        event_type=EventType.COMPETITION,
        title="Coding Challenge",
        status=EventStatus.PLANNED,
    )
    db_session.add(event)
    await db_session.flush()
    await db_session.refresh(event)
    return event


@pytest_asyncio.fixture
async def second_user(db_session: AsyncSession) -> User:
    from app.auth.security import hash_password
    from app.models.enums import UserRole

    user = User(
        id=uuid.uuid4(),
        email="competitor@example.com",
        password_hash=hash_password("comppass123"),
        name="Competitor",
        role=UserRole.STUDENT,
    )
    db_session.add(user)
    await db_session.flush()
    await db_session.refresh(user)
    return user


@pytest.mark.asyncio
class TestCompetitions:
    async def test_create_competition(
        self, client: AsyncClient, test_user: User, test_event: Event
    ):
        resp = await client.post(
            "/api/v1/competitions",
            json={"event_id": str(test_event.id), "max_participants": 10},
            headers=auth_header(test_user),
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["event_id"] == str(test_event.id)
        assert data["max_participants"] == 10

    async def test_get_competition(
        self, client: AsyncClient, test_user: User, test_event: Event
    ):
        create = await client.post(
            "/api/v1/competitions",
            json={"event_id": str(test_event.id)},
            headers=auth_header(test_user),
        )
        cid = create.json()["id"]

        resp = await client.get(
            f"/api/v1/competitions/{cid}",
            headers=auth_header(test_user),
        )
        assert resp.status_code == 200
        assert resp.json()["id"] == cid


@pytest.mark.asyncio
class TestParticipants:
    async def test_register_and_list(
        self, client: AsyncClient, test_user: User, test_event: Event
    ):
        create = await client.post(
            "/api/v1/competitions",
            json={"event_id": str(test_event.id)},
            headers=auth_header(test_user),
        )
        cid = create.json()["id"]

        # Register
        reg = await client.post(
            f"/api/v1/competitions/{cid}/participants",
            headers=auth_header(test_user),
        )
        assert reg.status_code == 201
        assert reg.json()["user_id"] == str(test_user.id)

        # List
        resp = await client.get(
            f"/api/v1/competitions/{cid}/participants",
            headers=auth_header(test_user),
        )
        assert resp.status_code == 200
        assert len(resp.json()) == 1

    async def test_capacity_limit(
        self, client: AsyncClient, test_user: User, second_user: User, test_event: Event
    ):
        create = await client.post(
            "/api/v1/competitions",
            json={"event_id": str(test_event.id), "max_participants": 1},
            headers=auth_header(test_user),
        )
        cid = create.json()["id"]

        # First registration succeeds
        await client.post(
            f"/api/v1/competitions/{cid}/participants",
            headers=auth_header(test_user),
        )

        # Second should fail (capacity = 1)
        resp = await client.post(
            f"/api/v1/competitions/{cid}/participants",
            headers=auth_header(second_user),
        )
        assert resp.status_code == 409


@pytest.mark.asyncio
class TestSubmissions:
    async def test_submit_and_grade(
        self, client: AsyncClient, test_user: User, test_event: Event
    ):
        headers = auth_header(test_user)

        # Create competition
        comp = await client.post(
            "/api/v1/competitions",
            json={"event_id": str(test_event.id)},
            headers=headers,
        )
        cid = comp.json()["id"]

        # Register
        await client.post(
            f"/api/v1/competitions/{cid}/participants",
            headers=headers,
        )

        # Submit
        sub = await client.post(
            f"/api/v1/competitions/{cid}/submissions",
            json={"content": {"code": "print('hello')"}},
            headers=headers,
        )
        assert sub.status_code == 201
        sub_id = sub.json()["id"]
        assert sub.json()["score"] is None

        # Grade
        grade = await client.patch(
            f"/api/v1/competitions/{cid}/submissions/{sub_id}/grade",
            json={"score": 95.5},
            headers=headers,
        )
        assert grade.status_code == 200
        assert float(grade.json()["score"]) == 95.5
        assert grade.json()["graded_at"] is not None

    async def test_non_participant_cannot_submit(
        self, client: AsyncClient, test_user: User, admin_user: User, test_event: Event
    ):
        headers = auth_header(test_user)

        comp = await client.post(
            "/api/v1/competitions",
            json={"event_id": str(test_event.id)},
            headers=headers,
        )
        cid = comp.json()["id"]

        resp = await client.post(
            f"/api/v1/competitions/{cid}/submissions",
            json={"content": {}},
            headers=auth_header(admin_user),  # not registered
        )
        assert resp.status_code == 403


@pytest.mark.asyncio
class TestScoreboard:
    async def test_generate_and_get_scoreboard(
        self, client: AsyncClient, test_user: User, test_event: Event
    ):
        headers = auth_header(test_user)

        comp = await client.post(
            "/api/v1/competitions",
            json={"event_id": str(test_event.id)},
            headers=headers,
        )
        cid = comp.json()["id"]

        # Register + submit + grade
        await client.post(f"/api/v1/competitions/{cid}/participants", headers=headers)
        sub = await client.post(
            f"/api/v1/competitions/{cid}/submissions",
            json={"content": {"answer": 42}},
            headers=headers,
        )
        await client.patch(
            f"/api/v1/competitions/{cid}/submissions/{sub.json()['id']}/grade",
            json={"score": 100},
            headers=headers,
        )

        # Generate scoreboard
        sb = await client.post(
            f"/api/v1/competitions/{cid}/scoreboard",
            headers=headers,
        )
        assert sb.status_code == 201
        assert sb.json()["is_final"] is False
        rankings = sb.json()["snapshot_data"]["rankings"]
        assert len(rankings) == 1
        assert rankings[0]["rank"] == 1

        # Get latest scoreboard
        latest = await client.get(
            f"/api/v1/competitions/{cid}/scoreboard",
            headers=headers,
        )
        assert latest.status_code == 200
        assert latest.json()["id"] == sb.json()["id"]
