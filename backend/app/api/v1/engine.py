from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.deps import get_current_user
from app.database import get_db
from app.models.activity import ActivityNode
from app.models.enums import NodeStatus, ScheduleStatus, UserRole
from app.models.project import Project
from app.models.schedule import Schedule
from app.models.user import User
from app.schemas.activity import ActivityNodeResponse
from app.schemas.engine import NodeTransitionRequest, WorkflowProjectionResponse
from app.services.workflow_engine import (
    load_project_graph,
    project_state_projection,
    transition_node,
)
from app.services.schedule_oracle import build_schedule_oracle
from app.services.visibility import can_user_access
from sqlalchemy import select

router = APIRouter()


@router.get("/oracle/schedules")
async def get_schedule_oracle(
    from_at: datetime,
    to_at: datetime,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if from_at >= to_at:
        raise HTTPException(status_code=422, detail="조회 종료 시각은 시작 시각보다 뒤여야 합니다.")
    result = await db.execute(
        select(Schedule).where(
            Schedule.status != ScheduleStatus.CANCELLED,
            Schedule.start_at < to_at,
            (Schedule.end_at.is_(None)) | (Schedule.end_at > from_at),
        )
    )
    visible: list[Schedule] = []
    for schedule in result.scalars().all():
        if schedule.visibility_policy_id is None or await can_user_access(
            db, current_user, schedule.visibility_policy_id
        ):
            visible.append(schedule)
    return build_schedule_oracle(
        visible,
        window_start=from_at,
        window_end=to_at,
    )


@router.get(
    "/projects/{project_id}/state",
    response_model=WorkflowProjectionResponse,
)
async def get_project_state(
    project_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = await db.get(Project, project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    nodes, edges = await load_project_graph(db, project_id)
    projection = project_state_projection(nodes, edges, user_id=current_user.id)
    return {
        "project_id": project_id,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        **projection,
    }


@router.post(
    "/projects/{project_id}/nodes/{node_id}/transition",
    response_model=ActivityNodeResponse,
)
async def apply_node_transition(
    project_id: UUID,
    node_id: UUID,
    body: NodeTransitionRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    node = await db.get(ActivityNode, node_id)
    if node is None or node.project_id != project_id:
        raise HTTPException(status_code=404, detail="Node not found")
    privileged = current_user.role in (UserRole.ADMIN, UserRole.TEACHER)
    if not privileged and node.assigned_user_id not in (None, current_user.id):
        raise HTTPException(status_code=403, detail="이 활동을 전환할 권한이 없습니다")
    try:
        target = NodeStatus(body.target_status)
        node = await transition_node(
            db,
            node,
            target,
            expected_version=body.expected_version,
        )
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    await db.refresh(node)
    return node
