"""Regression tests for the integrated Lunel engine and competition runtime."""

import uuid
from datetime import datetime, timedelta, timezone

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.activity import ActivityEdge, ActivityNode
from app.models.enums import (
    EdgeType,
    EventStatus,
    EventType,
    GroupType,
    NodeStatus,
    NodeType,
    ScheduleStatus,
    ScheduleSubtype,
    ScheduleType,
)
from app.models.event import Event
from app.models.group import Group
from app.models.project import Project
from app.models.schedule import Schedule
from app.models.user import User
from app.services.schedule_oracle import build_schedule_oracle
from app.services.workflow_engine import project_state_projection, transition_node
from tests.conftest import auth_header


@pytest.mark.asyncio
async def test_public_registration_cannot_self_assign_teacher_role(
    client: AsyncClient,
):
    response = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "fake-teacher@example.com",
            "password": "strongpassword123",
            "name": "Fake Teacher",
            "role": "TEACHER",
        },
    )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_problem_forge_publish_and_public_package_does_not_leak_tests(
    client: AsyncClient,
    teacher_user: User,
    test_user: User,
):
    teacher_headers = auth_header(teacher_user)
    created = await client.post(
        "/api/v1/problems",
        json={
            "slug": "lunar-sum",
            "title": "Lunar Sum",
            "statement_md": "두 수의 합을 출력하라.",
            "checker_type": "TOKENS",
        },
        headers=teacher_headers,
    )
    assert created.status_code == 201
    problem_id = created.json()["id"]

    hidden = await client.get(
        "/api/v1/problems", headers=auth_header(test_user)
    )
    assert hidden.json() == []

    group = await client.post(
        f"/api/v1/problems/{problem_id}/test-groups",
        json={"name": "main", "points": 100},
        headers=teacher_headers,
    )
    assert group.status_code == 201
    test_case = await client.post(
        f"/api/v1/problems/test-groups/{group.json()['id']}/cases",
        json={
            "name": "answer",
            "input_data": "",
            "expected_output": "42",
            "is_sample": False,
        },
        headers=teacher_headers,
    )
    assert test_case.status_code == 201

    for problem_status in ("REVIEW", "READY", "PUBLISHED"):
        updated = await client.patch(
            f"/api/v1/problems/{problem_id}",
            json={"status": problem_status},
            headers=teacher_headers,
        )
        assert updated.status_code == 200

    public_package = await client.get(
        f"/api/v1/problems/{problem_id}",
        headers=auth_header(test_user),
    )
    assert public_package.status_code == 200
    assert public_package.json()["test_groups"] == []
    assert public_package.json()["solutions"] == []
    assert public_package.json()["revisions"] == []


@pytest.mark.asyncio
async def test_reusable_problem_release_answer_judge_and_live_scoreboard(
    client: AsyncClient,
    db_session: AsyncSession,
    teacher_user: User,
    test_user: User,
):
    headers = auth_header(teacher_user)
    event = Event(
        id=uuid.uuid4(),
        event_type=EventType.COMPETITION,
        title="PHINULL Cup",
        status=EventStatus.IN_PROGRESS,
    )
    db_session.add(event)
    await db_session.flush()

    problem = await client.post(
        "/api/v1/problems",
        json={
            "slug": "phinull-answer",
            "title": "The Answer",
            "statement_md": "정답을 제출하라.",
            "checker_type": "TOKENS",
        },
        headers=headers,
    )
    problem_id = problem.json()["id"]
    group = await client.post(
        f"/api/v1/problems/{problem_id}/test-groups",
        json={"name": "answer"},
        headers=headers,
    )
    await client.post(
        f"/api/v1/problems/test-groups/{group.json()['id']}/cases",
        json={"name": "answer", "expected_output": "42"},
        headers=headers,
    )
    for problem_status in ("REVIEW", "READY", "PUBLISHED"):
        await client.patch(
            f"/api/v1/problems/{problem_id}",
            json={"status": problem_status},
            headers=headers,
        )

    competition = await client.post(
        "/api/v1/competitions",
        json={
            "event_id": str(event.id),
            "scoring_rule": {"mode": "IOI"},
        },
        headers=headers,
    )
    competition_id = competition.json()["id"]
    release = await client.post(
        f"/api/v1/competitions/{competition_id}/problems",
        json={"problem_id": problem_id, "label": "A", "points": 100},
        headers=headers,
    )
    assert release.status_code == 201

    student_headers = auth_header(test_user)
    await client.post(
        f"/api/v1/competitions/{competition_id}/participants",
        headers=student_headers,
    )
    submission = await client.post(
        f"/api/v1/competitions/{competition_id}/submissions",
        json={
            "competition_problem_id": release.json()["id"],
            "content": {"answer": " 42\n"},
        },
        headers=student_headers,
    )
    assert submission.status_code == 201
    assert submission.json()["verdict"] == "ACCEPTED"
    assert float(submission.json()["score"]) == 100

    scoreboard = await client.get(
        f"/api/v1/competitions/{competition_id}/scoreboard/live",
        headers=student_headers,
    )
    assert scoreboard.status_code == 200
    assert scoreboard.json()["rankings"][0]["name"] == test_user.name
    assert scoreboard.json()["rankings"][0]["problems"]["A"]["solved"] is True


@pytest.mark.asyncio
async def test_workflow_projection_and_transition_enforce_dependencies(
    db_session: AsyncSession,
    test_user: User,
):
    group = Group(
        id=uuid.uuid4(),
        name="Engine Team",
        type=GroupType.PROJECT_TEAM,
        owner_user_id=test_user.id,
    )
    db_session.add(group)
    await db_session.flush()
    project = Project(
        id=uuid.uuid4(),
        title="Lunel Engine",
        owner_group_id=group.id,
        created_by=test_user.id,
    )
    db_session.add(project)
    await db_session.flush()
    first = ActivityNode(
        id=uuid.uuid4(),
        project_id=project.id,
        node_type=NodeType.TASK,
        title="문제 검수",
        status=NodeStatus.TODO,
        assigned_user_id=test_user.id,
    )
    second = ActivityNode(
        id=uuid.uuid4(),
        project_id=project.id,
        node_type=NodeType.TASK,
        title="문제 공개",
        status=NodeStatus.TODO,
        assigned_user_id=test_user.id,
    )
    db_session.add_all([first, second])
    await db_session.flush()
    edge = ActivityEdge(
        id=uuid.uuid4(),
        from_node_id=first.id,
        to_node_id=second.id,
        edge_type=EdgeType.DEPENDS_ON,
    )
    db_session.add(edge)
    await db_session.flush()

    projection = project_state_projection([first, second], [edge])
    second_projection = next(
        node for node in projection["nodes"] if node["id"] == str(second.id)
    )
    assert second_projection["ready"] is False
    assert second_projection["blocked_by"] == [str(first.id)]

    with pytest.raises(ValueError):
        await transition_node(db_session, second, NodeStatus.IN_PROGRESS)
    await transition_node(db_session, first, NodeStatus.IN_PROGRESS)
    await transition_node(db_session, first, NodeStatus.DONE)
    await transition_node(db_session, second, NodeStatus.IN_PROGRESS)
    assert second.status == NodeStatus.IN_PROGRESS


def test_schedule_oracle_explains_and_proposes_conflict_resolution():
    now = datetime.now(timezone.utc)
    owner = uuid.uuid4()
    official = Schedule(
        id=uuid.uuid4(),
        title="학교 공식 행사",
        type=ScheduleType.EVENT,
        subtype=ScheduleSubtype.GENERAL_EVENT,
        start_at=now,
        end_at=now + timedelta(hours=2),
        status=ScheduleStatus.SCHEDULED,
        creator_id=owner,
        importance_score=90,
        base_importance=60,
        authority_weight=20,
        urgency_weight=5,
        feedback_weight=5,
        dependency_weight=0,
        location="강당",
    )
    project = Schedule(
        id=uuid.uuid4(),
        title="학생 프로젝트 발표",
        type=ScheduleType.PROJECT,
        subtype=ScheduleSubtype.TEAM_PROJECT,
        start_at=now + timedelta(hours=1),
        end_at=now + timedelta(hours=2),
        status=ScheduleStatus.SCHEDULED,
        creator_id=owner,
        importance_score=65,
        base_importance=50,
        authority_weight=0,
        urgency_weight=10,
        feedback_weight=5,
        dependency_weight=0,
        location="강당",
    )
    result = build_schedule_oracle(
        [project, official],
        window_start=now - timedelta(hours=1),
        window_end=now + timedelta(hours=4),
    )
    assert result["summary"]["hard_conflict_count"] == 1
    assert result["proposals"][0]["schedule_id"] == str(project.id)
    assert result["proposals"][0]["requires_approval"] is True
