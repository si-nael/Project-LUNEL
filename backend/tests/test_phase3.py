"""Tests for Phase 3: DAG, history, expected value, procedural key."""
import uuid
from datetime import datetime, timezone, timedelta

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import (
    UserRole, GroupType, ProjectStatus, NodeType, NodeStatus, EdgeType,
    ScheduleType, ScheduleStatus, ChangeType, VisibilityScopeType,
)
from app.models.user import User
from app.models.group import Group
from app.models.project import Project
from app.models.schedule import Schedule
from app.models.activity import ActivityNode, ActivityEdge
from app.models.visibility import VisibilityPolicy
from app.services.dag import has_cycle, would_create_cycle, topological_sort, get_dag_layers
from app.services.history import (
    record_schedule_change, record_project_change,
    get_schedule_history, get_project_history,
    get_schedule_at,
)
from app.services.expected_value import Choice, analyze_choice, analyze_choices, recommend_strategy
from app.services.procedural_key import create_challenge, verify_challenge, has_verified_challenge


@pytest_asyncio.fixture
async def project_fixture(db_session: AsyncSession, test_user: User, test_group: Group):
    project = Project(
        id=uuid.uuid4(),
        title="DAG Test Project",
        owner_group_id=test_group.id,
        created_by=test_user.id,
        status=ProjectStatus.ACTIVE,
    )
    db_session.add(project)
    await db_session.flush()
    await db_session.refresh(project)
    return project


@pytest_asyncio.fixture
async def dag_nodes(db_session: AsyncSession, project_fixture: Project):
    """Create A -> B -> C linear DAG."""
    a = ActivityNode(
        id=uuid.uuid4(), project_id=project_fixture.id,
        node_type=NodeType.TASK, title="Node A",
    )
    b = ActivityNode(
        id=uuid.uuid4(), project_id=project_fixture.id,
        node_type=NodeType.TASK, title="Node B",
    )
    c = ActivityNode(
        id=uuid.uuid4(), project_id=project_fixture.id,
        node_type=NodeType.TASK, title="Node C",
    )
    db_session.add_all([a, b, c])
    await db_session.flush()

    edge_ab = ActivityEdge(
        id=uuid.uuid4(), from_node_id=a.id, to_node_id=b.id,
        edge_type=EdgeType.DEPENDS_ON,
    )
    edge_bc = ActivityEdge(
        id=uuid.uuid4(), from_node_id=b.id, to_node_id=c.id,
        edge_type=EdgeType.DEPENDS_ON,
    )
    db_session.add_all([edge_ab, edge_bc])
    await db_session.flush()
    return a, b, c


@pytest.mark.asyncio
class TestDAGService:
    async def test_no_cycle_linear(self, db_session, project_fixture, dag_nodes):
        assert await has_cycle(db_session, project_fixture.id) is False

    async def test_would_create_cycle(self, db_session, project_fixture, dag_nodes):
        a, b, c = dag_nodes
        # C -> A would create a cycle
        assert await would_create_cycle(db_session, project_fixture.id, c.id, a.id) is True

    async def test_would_not_create_cycle(self, db_session, project_fixture, dag_nodes):
        a, b, c = dag_nodes
        # A -> C would not create a cycle (shortcut, no cycle)
        assert await would_create_cycle(db_session, project_fixture.id, a.id, c.id) is False

    async def test_topological_sort(self, db_session, project_fixture, dag_nodes):
        a, b, c = dag_nodes
        order = await topological_sort(db_session, project_fixture.id)
        assert order.index(a.id) < order.index(b.id)
        assert order.index(b.id) < order.index(c.id)

    async def test_dag_layers(self, db_session, project_fixture, dag_nodes):
        a, b, c = dag_nodes
        layers = await get_dag_layers(db_session, project_fixture.id)
        assert len(layers) == 3
        assert a.id in layers[0]
        assert b.id in layers[1]
        assert c.id in layers[2]

    async def test_empty_project_no_cycle(self, db_session, project_fixture):
        assert await has_cycle(db_session, project_fixture.id) is False

    async def test_topological_sort_empty(self, db_session, project_fixture):
        order = await topological_sort(db_session, project_fixture.id)
        assert order == []


@pytest_asyncio.fixture
async def schedule_for_history(db_session: AsyncSession, test_user: User):
    schedule = Schedule(
        id=uuid.uuid4(),
        title="History Test Schedule",
        type=ScheduleType.EVENT,
        subtype="GENERAL_EVENT",
        start_at=datetime.now(timezone.utc),
        status=ScheduleStatus.SCHEDULED,
        creator_id=test_user.id,
    )
    db_session.add(schedule)
    await db_session.flush()
    await db_session.refresh(schedule)
    return schedule


@pytest.mark.asyncio
class TestHistoryService:
    async def test_record_schedule_create(self, db_session, schedule_for_history, test_user):
        entry = await record_schedule_change(
            db_session, schedule_for_history, test_user.id, ChangeType.CREATE,
        )
        assert entry.change_type == ChangeType.CREATE
        assert entry.new_data is not None
        assert entry.previous_data is None
        assert entry.new_data["title"] == "History Test Schedule"

    async def test_record_schedule_update(self, db_session, schedule_for_history, test_user):
        # Record initial state
        await record_schedule_change(
            db_session, schedule_for_history, test_user.id, ChangeType.CREATE,
        )
        # Simulate update
        old_data = {"title": "History Test Schedule"}
        schedule_for_history.title = "Updated Title"
        entry = await record_schedule_change(
            db_session, schedule_for_history, test_user.id,
            ChangeType.UPDATE, previous_data=old_data,
        )
        assert entry.change_type == ChangeType.UPDATE
        assert entry.previous_data["title"] == "History Test Schedule"
        assert entry.new_data["title"] == "Updated Title"

    async def test_get_schedule_history(self, db_session, schedule_for_history, test_user):
        await record_schedule_change(
            db_session, schedule_for_history, test_user.id, ChangeType.CREATE,
        )
        history = await get_schedule_history(db_session, schedule_for_history.id)
        assert len(history) == 1

    async def test_get_schedule_at(self, db_session, schedule_for_history, test_user):
        await record_schedule_change(
            db_session, schedule_for_history, test_user.id, ChangeType.CREATE,
        )
        # Query at a future time should return the data
        future = datetime.now(timezone.utc) + timedelta(hours=1)
        data = await get_schedule_at(db_session, schedule_for_history.id, future)
        assert data is not None
        assert data["title"] == "History Test Schedule"

    async def test_record_project_change(self, db_session, project_fixture, test_user):
        entry = await record_project_change(
            db_session, project_fixture, test_user.id, ChangeType.CREATE,
        )
        assert entry.change_type == ChangeType.CREATE
        assert entry.new_data["title"] == "DAG Test Project"

    async def test_get_project_history(self, db_session, project_fixture, test_user):
        await record_project_change(
            db_session, project_fixture, test_user.id, ChangeType.CREATE,
        )
        history = await get_project_history(db_session, project_fixture.id)
        assert len(history) == 1


class TestExpectedValue:
    def test_single_choice_analysis(self):
        choice = Choice(
            name="A",
            outcomes=[
                {"probability": 0.5, "score": 100},
                {"probability": 0.5, "score": 0},
            ],
        )
        result = analyze_choice(choice)
        assert result.expected_value == 50.0
        assert result.variance == 2500.0
        assert result.min_score == 0
        assert result.max_score == 100

    def test_multiple_choices(self):
        choices = [
            Choice(name="Safe", outcomes=[{"probability": 1.0, "score": 50}]),
            Choice(
                name="Risky",
                outcomes=[
                    {"probability": 0.5, "score": 100},
                    {"probability": 0.5, "score": 0},
                ],
            ),
        ]
        results = analyze_choices(choices)
        # Both have EV=50, but Safe is first (sorted by EV, same value → stable)
        assert len(results) == 2
        assert results[0].expected_value == 50.0

    def test_recommend_strategy(self):
        choices = [
            Choice(name="Safe", outcomes=[{"probability": 1.0, "score": 55}]),
            Choice(
                name="Risky",
                outcomes=[
                    {"probability": 0.5, "score": 120},
                    {"probability": 0.5, "score": 0},
                ],
            ),
        ]
        results = analyze_choices(choices)
        strategy = recommend_strategy(results)
        assert strategy["best_expected_value"]["choice"] == "Risky"
        assert strategy["safest_choice"]["choice"] == "Safe"
        assert "recommendation" in strategy

    def test_empty_recommendation(self):
        strategy = recommend_strategy([])
        assert strategy["recommendation"] == "데이터 없음"


@pytest.mark.asyncio
class TestProceduralKey:
    async def test_create_challenge(self, db_session, test_user):
        policy = VisibilityPolicy(
            id=uuid.uuid4(),
            scope_type=VisibilityScopeType.PROCEDURAL_KEY,
        )
        db_session.add(policy)
        await db_session.flush()

        challenge = await create_challenge(db_session, policy.id, test_user.id)
        assert challenge.status.value == "PENDING"
        assert challenge.challenge_data is not None
        assert challenge.attempts == 0

    async def test_verify_challenge_correct(self, db_session, test_user):
        policy = VisibilityPolicy(
            id=uuid.uuid4(),
            scope_type=VisibilityScopeType.PROCEDURAL_KEY,
            rule_expression_json={"question": "수도는?", "answer": "서울"},
        )
        db_session.add(policy)
        await db_session.flush()

        challenge = await create_challenge(
            db_session, policy.id, test_user.id, challenge_type="text"
        )
        success, msg = await verify_challenge(db_session, challenge.id, "서울")
        assert success is True
        assert "성공" in msg

    async def test_verify_challenge_wrong(self, db_session, test_user):
        policy = VisibilityPolicy(
            id=uuid.uuid4(),
            scope_type=VisibilityScopeType.PROCEDURAL_KEY,
            rule_expression_json={"question": "수도는?", "answer": "서울"},
        )
        db_session.add(policy)
        await db_session.flush()

        challenge = await create_challenge(
            db_session, policy.id, test_user.id, challenge_type="text"
        )
        success, msg = await verify_challenge(db_session, challenge.id, "부산")
        assert success is False
        assert "오답" in msg

    async def test_max_attempts_exceeded(self, db_session, test_user):
        policy = VisibilityPolicy(
            id=uuid.uuid4(),
            scope_type=VisibilityScopeType.PROCEDURAL_KEY,
            rule_expression_json={"question": "1+1=?", "answer": "2"},
        )
        db_session.add(policy)
        await db_session.flush()

        challenge = await create_challenge(
            db_session, policy.id, test_user.id,
            challenge_type="text", max_attempts=2,
        )
        await verify_challenge(db_session, challenge.id, "wrong1")
        success, msg = await verify_challenge(db_session, challenge.id, "wrong2")
        assert success is False
        assert "초과" in msg

    async def test_has_verified_challenge(self, db_session, test_user):
        policy = VisibilityPolicy(
            id=uuid.uuid4(),
            scope_type=VisibilityScopeType.PROCEDURAL_KEY,
            rule_expression_json={"question": "테스트", "answer": "ok"},
        )
        db_session.add(policy)
        await db_session.flush()

        # Before verification
        assert await has_verified_challenge(db_session, policy.id, test_user.id) is False

        # After successful verification
        challenge = await create_challenge(
            db_session, policy.id, test_user.id, challenge_type="text"
        )
        await verify_challenge(db_session, challenge.id, "ok")
        assert await has_verified_challenge(db_session, policy.id, test_user.id) is True
