"""Tests for API endpoints via httpx AsyncClient."""
import uuid

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.models.enums import UserRole
from app.auth.security import hash_password
from tests.conftest import auth_header


@pytest.mark.asyncio
class TestAuthEndpoints:
    async def test_register_success(self, client: AsyncClient):
        resp = await client.post("/api/v1/auth/register", json={
            "email": "newuser@example.com",
            "password": "strongpassword123",
            "name": "New User",
            "role": "STUDENT",
        })
        assert resp.status_code == 201
        data = resp.json()
        assert data["email"] == "newuser@example.com"
        assert data["name"] == "New User"
        assert "password" not in data
        assert "password_hash" not in data

    async def test_register_duplicate_email(self, client: AsyncClient, test_user: User):
        resp = await client.post("/api/v1/auth/register", json={
            "email": "test@example.com",  # same as test_user
            "password": "strongpassword123",
            "name": "Duplicate User",
        })
        assert resp.status_code == 409

    async def test_register_short_password(self, client: AsyncClient):
        resp = await client.post("/api/v1/auth/register", json={
            "email": "short@example.com",
            "password": "short",
            "name": "Short Pass",
        })
        assert resp.status_code == 422  # validation error

    async def test_login_success(self, client: AsyncClient, test_user: User):
        resp = await client.post("/api/v1/auth/login", json={
            "email": "test@example.com",
            "password": "testpassword123",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["token_type"] == "bearer"

    async def test_login_wrong_password(self, client: AsyncClient, test_user: User):
        resp = await client.post("/api/v1/auth/login", json={
            "email": "test@example.com",
            "password": "wrongpassword",
        })
        assert resp.status_code == 401

    async def test_login_nonexistent_user(self, client: AsyncClient):
        resp = await client.post("/api/v1/auth/login", json={
            "email": "nobody@example.com",
            "password": "whatever123",
        })
        assert resp.status_code == 401

    async def test_refresh_token(self, client: AsyncClient, test_user: User):
        # Login first
        login_resp = await client.post("/api/v1/auth/login", json={
            "email": "test@example.com",
            "password": "testpassword123",
        })
        refresh_token = login_resp.json()["refresh_token"]

        # Refresh
        resp = await client.post("/api/v1/auth/refresh", json={
            "refresh_token": refresh_token,
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "access_token" in data
        assert "refresh_token" in data

    async def test_refresh_invalid_token(self, client: AsyncClient):
        resp = await client.post("/api/v1/auth/refresh", json={
            "refresh_token": "invalid.token.here",
        })
        assert resp.status_code == 401


@pytest.mark.asyncio
class TestUserEndpoints:
    async def test_get_me(self, client: AsyncClient, test_user: User):
        resp = await client.get("/api/v1/users/me", headers=auth_header(test_user))
        assert resp.status_code == 200
        data = resp.json()
        assert data["email"] == "test@example.com"
        assert data["name"] == "Test User"

    async def test_get_me_no_auth(self, client: AsyncClient):
        resp = await client.get("/api/v1/users/me")
        assert resp.status_code == 403  # no bearer token


@pytest.mark.asyncio
class TestGroupEndpoints:
    async def test_create_group(self, client: AsyncClient, test_user: User):
        resp = await client.post("/api/v1/groups", json={
            "name": "My Club",
            "type": "CLUB",
        }, headers=auth_header(test_user))
        assert resp.status_code == 201
        data = resp.json()
        assert data["name"] == "My Club"
        assert data["type"] == "CLUB"
        assert data["member_count"] == 1  # creator auto-added

    async def test_list_groups(self, client: AsyncClient, test_user: User, test_group):
        resp = await client.get("/api/v1/groups", headers=auth_header(test_user))
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) >= 1

    async def test_get_group(self, client: AsyncClient, test_user: User, test_group):
        resp = await client.get(
            f"/api/v1/groups/{test_group.id}",
            headers=auth_header(test_user),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["name"] == "Test Group"

    async def test_get_nonexistent_group(self, client: AsyncClient, test_user: User):
        resp = await client.get(
            f"/api/v1/groups/{uuid.uuid4()}",
            headers=auth_header(test_user),
        )
        assert resp.status_code == 404


@pytest.mark.asyncio
class TestScheduleEndpoints:
    async def test_create_schedule(self, client: AsyncClient, test_user: User):
        resp = await client.post("/api/v1/schedules", json={
            "title": "Team Meeting",
            "type": "EVENT",
            "subtype": "MEETING",
            "start_at": "2026-04-01T10:00:00Z",
            "end_at": "2026-04-01T11:00:00Z",
            "base_importance": 60,
        }, headers=auth_header(test_user))
        assert resp.status_code == 201
        data = resp.json()
        assert data["title"] == "Team Meeting"
        assert data["base_importance"] == 60
        assert data["importance_score"] >= 60  # base + urgency at minimum

    async def test_list_schedules(self, client: AsyncClient, test_user: User):
        # Create one first
        await client.post("/api/v1/schedules", json={
            "title": "Task A",
            "type": "PROJECT",
            "subtype": "PERSONAL_PROJECT",
            "start_at": "2026-04-01T09:00:00Z",
        }, headers=auth_header(test_user))

        resp = await client.get("/api/v1/schedules", headers=auth_header(test_user))
        assert resp.status_code == 200
        assert len(resp.json()) >= 1

    async def test_delete_schedule_not_owner(self, client: AsyncClient, test_user: User, admin_user: User):
        # Create as test_user
        create_resp = await client.post("/api/v1/schedules", json={
            "title": "Owner Only",
            "type": "EVENT",
            "subtype": "GENERAL_EVENT",
            "start_at": "2026-04-01T09:00:00Z",
        }, headers=auth_header(test_user))
        sid = create_resp.json()["id"]

        # Admin can delete (ADMIN role)
        resp = await client.delete(
            f"/api/v1/schedules/{sid}",
            headers=auth_header(admin_user),
        )
        assert resp.status_code == 204


@pytest.mark.asyncio
class TestProjectEndpoints:
    async def test_create_project(self, client: AsyncClient, test_user: User, test_group):
        resp = await client.post("/api/v1/projects", json={
            "title": "Science Fair",
            "description": "Annual science fair project",
            "owner_group_id": str(test_group.id),
        }, headers=auth_header(test_user))
        assert resp.status_code == 201
        data = resp.json()
        assert data["title"] == "Science Fair"
        assert data["status"] == "DRAFT"
        assert data["progress_percent"] == 0

    async def test_update_project(self, client: AsyncClient, test_user: User, test_group):
        create_resp = await client.post("/api/v1/projects", json={
            "title": "Update Me",
            "owner_group_id": str(test_group.id),
        }, headers=auth_header(test_user))
        pid = create_resp.json()["id"]

        resp = await client.patch(f"/api/v1/projects/{pid}", json={
            "progress_percent": 50,
            "status": "ACTIVE",
        }, headers=auth_header(test_user))
        assert resp.status_code == 200
        assert resp.json()["progress_percent"] == 50
        assert resp.json()["status"] == "ACTIVE"


@pytest.mark.asyncio
class TestRatingEndpoints:
    async def test_rate_schedule(self, client: AsyncClient, test_user: User, admin_user: User):
        # Create schedule as test_user
        create_resp = await client.post("/api/v1/schedules", json={
            "title": "Rate This",
            "type": "EVENT",
            "subtype": "GENERAL_EVENT",
            "start_at": "2026-04-01T09:00:00Z",
        }, headers=auth_header(test_user))
        sid = create_resp.json()["id"]

        # Rate as admin_user (different user)
        resp = await client.post(f"/api/v1/schedules/{sid}/ratings", json={
            "score": 4,
            "usefulness_score": 5,
            "comment": "Great event!",
        }, headers=auth_header(admin_user))
        assert resp.status_code == 201
        assert resp.json()["score"] == 4

    async def test_self_rating_forbidden(self, client: AsyncClient, test_user: User):
        create_resp = await client.post("/api/v1/schedules", json={
            "title": "My Own",
            "type": "EVENT",
            "subtype": "GENERAL_EVENT",
            "start_at": "2026-04-01T09:00:00Z",
        }, headers=auth_header(test_user))
        sid = create_resp.json()["id"]

        resp = await client.post(f"/api/v1/schedules/{sid}/ratings", json={
            "score": 5,
        }, headers=auth_header(test_user))
        assert resp.status_code == 403

    async def test_duplicate_rating_rejected(self, client: AsyncClient, test_user: User, admin_user: User):
        create_resp = await client.post("/api/v1/schedules", json={
            "title": "No Duplicates",
            "type": "EVENT",
            "subtype": "GENERAL_EVENT",
            "start_at": "2026-04-01T09:00:00Z",
        }, headers=auth_header(test_user))
        sid = create_resp.json()["id"]

        await client.post(f"/api/v1/schedules/{sid}/ratings", json={
            "score": 3,
        }, headers=auth_header(admin_user))

        resp = await client.post(f"/api/v1/schedules/{sid}/ratings", json={
            "score": 5,
        }, headers=auth_header(admin_user))
        assert resp.status_code == 409

    async def test_ratings_summary(self, client: AsyncClient, test_user: User, admin_user: User):
        create_resp = await client.post("/api/v1/schedules", json={
            "title": "Summary Test",
            "type": "EVENT",
            "subtype": "GENERAL_EVENT",
            "start_at": "2026-04-01T09:00:00Z",
        }, headers=auth_header(test_user))
        sid = create_resp.json()["id"]

        await client.post(f"/api/v1/schedules/{sid}/ratings", json={
            "score": 4,
        }, headers=auth_header(admin_user))

        resp = await client.get(
            f"/api/v1/schedules/{sid}/ratings-summary",
            headers=auth_header(test_user),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["total_ratings"] == 1
        assert data["avg_score"] == 4.0


@pytest.mark.asyncio
class TestHealthEndpoint:
    async def test_health(self, client: AsyncClient):
        resp = await client.get("/health")
        assert resp.status_code == 200
        assert resp.json()["status"] == "ok"
