"""Tests for Events API and Sync Jobs."""
import uuid

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from tests.conftest import auth_header


@pytest.mark.asyncio
class TestEvents:
    async def test_create_event(self, client: AsyncClient, admin_user: User):
        resp = await client.post(
            "/api/v1/events",
            json={"event_type": "COMPETITION", "title": "Math Olympiad"},
            headers=auth_header(admin_user),
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["title"] == "Math Olympiad"
        assert data["event_type"] == "COMPETITION"
        assert data["status"] == "PLANNED"
        assert data["result_sync_state"] == "NOT_SYNCED"

    async def test_list_events(self, client: AsyncClient, admin_user: User):
        headers = auth_header(admin_user)
        await client.post(
            "/api/v1/events",
            json={"event_type": "WORKSHOP", "title": "Workshop 1"},
            headers=headers,
        )
        await client.post(
            "/api/v1/events",
            json={"event_type": "CHALLENGE", "title": "Challenge 1"},
            headers=headers,
        )

        resp = await client.get("/api/v1/events", headers=headers)
        assert resp.status_code == 200
        assert len(resp.json()) >= 2

    async def test_get_event(self, client: AsyncClient, admin_user: User):
        headers = auth_header(admin_user)
        create = await client.post(
            "/api/v1/events",
            json={"event_type": "EXHIBITION", "title": "Art Show"},
            headers=headers,
        )
        eid = create.json()["id"]

        resp = await client.get(f"/api/v1/events/{eid}", headers=headers)
        assert resp.status_code == 200
        assert resp.json()["title"] == "Art Show"

    async def test_get_nonexistent_event(self, client: AsyncClient, test_user: User):
        fake_id = str(uuid.uuid4())
        resp = await client.get(
            f"/api/v1/events/{fake_id}",
            headers=auth_header(test_user),
        )
        assert resp.status_code == 404

    async def test_update_event(self, client: AsyncClient, admin_user: User):
        headers = auth_header(admin_user)
        create = await client.post(
            "/api/v1/events",
            json={"event_type": "COMPETITION", "title": "Original"},
            headers=headers,
        )
        eid = create.json()["id"]

        resp = await client.patch(
            f"/api/v1/events/{eid}",
            json={"title": "Updated", "status": "REGISTRATION_OPEN"},
            headers=headers,
        )
        assert resp.status_code == 200
        assert resp.json()["title"] == "Updated"
        assert resp.json()["status"] == "REGISTRATION_OPEN"


@pytest.mark.asyncio
class TestSyncJobs:
    async def test_sync_event(self, client: AsyncClient, admin_user: User):
        headers = auth_header(admin_user)
        event = await client.post(
            "/api/v1/events",
            json={"event_type": "COMPETITION", "title": "Sync Test"},
            headers=headers,
        )
        eid = event.json()["id"]

        resp = await client.post(
            f"/api/v1/events/{eid}/sync",
            headers=headers,
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["job_type"] == "MANUAL"
        assert data["status"] == "SUCCESS"
        assert data["result_summary"] is not None

        # Verify event state updated
        ev = await client.get(f"/api/v1/events/{eid}", headers=headers)
        assert ev.json()["result_sync_state"] == "SYNCED"

    async def test_list_sync_jobs(self, client: AsyncClient, admin_user: User):
        headers = auth_header(admin_user)
        event = await client.post(
            "/api/v1/events",
            json={"event_type": "COMPETITION", "title": "Jobs Test"},
            headers=headers,
        )
        eid = event.json()["id"]

        # Create two sync jobs
        await client.post(f"/api/v1/events/{eid}/sync", headers=headers)
        await client.post(f"/api/v1/events/{eid}/sync", headers=headers)

        resp = await client.get(
            f"/api/v1/events/{eid}/sync-jobs",
            headers=headers,
        )
        assert resp.status_code == 200
        assert len(resp.json()) == 2
