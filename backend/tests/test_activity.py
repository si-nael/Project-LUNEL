"""Tests for Phase 2: Activity Nodes & Edges (project task tree)."""
import uuid

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import ProjectStatus, GroupType, MembershipRole
from app.models.group import Group, GroupMembership
from app.models.project import Project
from app.models.user import User
from tests.conftest import auth_header


@pytest_asyncio.fixture
async def project_with_group(db_session: AsyncSession, test_user: User):
    group = Group(
        id=uuid.uuid4(),
        name="Activity Test Group",
        type=GroupType.CLUB,
        owner_user_id=test_user.id,
    )
    db_session.add(group)
    await db_session.flush()

    membership = GroupMembership(
        id=uuid.uuid4(),
        user_id=test_user.id,
        group_id=group.id,
        membership_role=MembershipRole.OWNER,
    )
    db_session.add(membership)

    project = Project(
        id=uuid.uuid4(),
        title="Task Tree Project",
        owner_group_id=group.id,
        created_by=test_user.id,
        status=ProjectStatus.ACTIVE,
    )
    db_session.add(project)
    await db_session.flush()
    await db_session.refresh(project)
    return project


@pytest.mark.asyncio
class TestActivityNodes:
    async def test_create_root_node(
        self, client: AsyncClient, test_user: User, project_with_group: Project
    ):
        resp = await client.post(
            f"/api/v1/projects/{project_with_group.id}/nodes",
            json={"title": "Milestone 1", "node_type": "MILESTONE", "order_index": 0},
            headers=auth_header(test_user),
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["title"] == "Milestone 1"
        assert data["node_type"] == "MILESTONE"
        assert data["parent_id"] is None
        assert data["progress"] == 0

    async def test_create_child_node(
        self, client: AsyncClient, test_user: User, project_with_group: Project
    ):
        # Create parent
        parent_resp = await client.post(
            f"/api/v1/projects/{project_with_group.id}/nodes",
            json={"title": "Parent", "node_type": "MILESTONE", "order_index": 0},
            headers=auth_header(test_user),
        )
        parent_id = parent_resp.json()["id"]

        # Create child
        child_resp = await client.post(
            f"/api/v1/projects/{project_with_group.id}/nodes",
            json={
                "title": "Task 1",
                "node_type": "TASK",
                "order_index": 0,
                "parent_id": parent_id,
            },
            headers=auth_header(test_user),
        )
        assert child_resp.status_code == 201
        assert child_resp.json()["parent_id"] == parent_id

    async def test_list_nodes(
        self, client: AsyncClient, test_user: User, project_with_group: Project
    ):
        headers = auth_header(test_user)
        pid = str(project_with_group.id)

        await client.post(
            f"/api/v1/projects/{pid}/nodes",
            json={"title": "A", "node_type": "TASK", "order_index": 0},
            headers=headers,
        )
        await client.post(
            f"/api/v1/projects/{pid}/nodes",
            json={"title": "B", "node_type": "TASK", "order_index": 1},
            headers=headers,
        )

        resp = await client.get(f"/api/v1/projects/{pid}/nodes", headers=headers)
        assert resp.status_code == 200
        assert len(resp.json()) == 2

    async def test_update_node_progress(
        self, client: AsyncClient, test_user: User, project_with_group: Project
    ):
        headers = auth_header(test_user)
        pid = str(project_with_group.id)

        create_resp = await client.post(
            f"/api/v1/projects/{pid}/nodes",
            json={"title": "Node", "node_type": "TASK", "order_index": 0},
            headers=headers,
        )
        node_id = create_resp.json()["id"]

        resp = await client.patch(
            f"/api/v1/projects/{pid}/nodes/{node_id}",
            json={"progress": 50},
            headers=headers,
        )
        assert resp.status_code == 200
        assert resp.json()["progress"] == 50

    async def test_delete_node(
        self, client: AsyncClient, test_user: User, project_with_group: Project
    ):
        headers = auth_header(test_user)
        pid = str(project_with_group.id)

        create_resp = await client.post(
            f"/api/v1/projects/{pid}/nodes",
            json={"title": "Deletable", "node_type": "TASK", "order_index": 0},
            headers=headers,
        )
        node_id = create_resp.json()["id"]

        resp = await client.delete(
            f"/api/v1/projects/{pid}/nodes/{node_id}",
            headers=headers,
        )
        assert resp.status_code == 204

    async def test_delete_node_with_children_fails(
        self, client: AsyncClient, test_user: User, project_with_group: Project
    ):
        headers = auth_header(test_user)
        pid = str(project_with_group.id)

        parent_resp = await client.post(
            f"/api/v1/projects/{pid}/nodes",
            json={"title": "Parent", "node_type": "MILESTONE", "order_index": 0},
            headers=headers,
        )
        parent_id = parent_resp.json()["id"]

        await client.post(
            f"/api/v1/projects/{pid}/nodes",
            json={
                "title": "Child",
                "node_type": "TASK",
                "order_index": 0,
                "parent_id": parent_id,
            },
            headers=headers,
        )

        resp = await client.delete(
            f"/api/v1/projects/{pid}/nodes/{parent_id}",
            headers=headers,
        )
        assert resp.status_code == 409

    async def test_get_tree(
        self, client: AsyncClient, test_user: User, project_with_group: Project
    ):
        headers = auth_header(test_user)
        pid = str(project_with_group.id)

        await client.post(
            f"/api/v1/projects/{pid}/nodes",
            json={"title": "Root", "node_type": "MILESTONE", "order_index": 0},
            headers=headers,
        )

        resp = await client.get(f"/api/v1/projects/{pid}/tree", headers=headers)
        assert resp.status_code == 200
        assert len(resp.json()) >= 1


@pytest.mark.asyncio
class TestActivityEdges:
    async def test_create_edge(
        self, client: AsyncClient, test_user: User, project_with_group: Project
    ):
        headers = auth_header(test_user)
        pid = str(project_with_group.id)

        n1 = await client.post(
            f"/api/v1/projects/{pid}/nodes",
            json={"title": "N1", "node_type": "TASK", "order_index": 0},
            headers=headers,
        )
        n2 = await client.post(
            f"/api/v1/projects/{pid}/nodes",
            json={"title": "N2", "node_type": "TASK", "order_index": 1},
            headers=headers,
        )

        resp = await client.post(
            f"/api/v1/projects/{pid}/edges",
            json={
                "from_node_id": n1.json()["id"],
                "to_node_id": n2.json()["id"],
                "edge_type": "DEPENDS_ON",
            },
            headers=headers,
        )
        assert resp.status_code == 201
        assert resp.json()["edge_type"] == "DEPENDS_ON"

    async def test_self_loop_rejected(
        self, client: AsyncClient, test_user: User, project_with_group: Project
    ):
        headers = auth_header(test_user)
        pid = str(project_with_group.id)

        n = await client.post(
            f"/api/v1/projects/{pid}/nodes",
            json={"title": "Solo", "node_type": "TASK", "order_index": 0},
            headers=headers,
        )
        nid = n.json()["id"]

        resp = await client.post(
            f"/api/v1/projects/{pid}/edges",
            json={"from_node_id": nid, "to_node_id": nid, "edge_type": "DEPENDS_ON"},
            headers=headers,
        )
        assert resp.status_code == 400
