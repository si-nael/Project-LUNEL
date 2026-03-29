from uuid import UUID
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.deps import get_current_user
from app.database import get_db
from app.models.schedule import Schedule
from app.models.project import Project
from app.models.user import User
from app.schemas.history import (
    ScheduleHistoryResponse, ProjectHistoryResponse, TemporalQueryResponse,
)
from app.services.history import (
    get_schedule_history, get_project_history,
    get_schedule_at, get_project_at,
)

router = APIRouter()


@router.get(
    "/schedules/{schedule_id}/history",
    response_model=list[ScheduleHistoryResponse],
)
async def list_schedule_history(
    schedule_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    schedule = await db.get(Schedule, schedule_id)
    if schedule is None:
        raise HTTPException(status_code=404, detail="Schedule not found")
    return await get_schedule_history(db, schedule_id)


@router.get(
    "/schedules/{schedule_id}/at",
    response_model=TemporalQueryResponse,
)
async def schedule_at_time(
    schedule_id: UUID,
    timestamp: datetime = Query(..., description="ISO 8601 timestamp"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    schedule = await db.get(Schedule, schedule_id)
    if schedule is None:
        raise HTTPException(status_code=404, detail="Schedule not found")
    data = await get_schedule_at(db, schedule_id, timestamp)
    return TemporalQueryResponse(
        entity_id=schedule_id, timestamp=timestamp, data=data
    )


@router.get(
    "/projects/{project_id}/history",
    response_model=list[ProjectHistoryResponse],
)
async def list_project_history(
    project_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = await db.get(Project, project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return await get_project_history(db, project_id)


@router.get(
    "/projects/{project_id}/at",
    response_model=TemporalQueryResponse,
)
async def project_at_time(
    project_id: UUID,
    timestamp: datetime = Query(..., description="ISO 8601 timestamp"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = await db.get(Project, project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    data = await get_project_at(db, project_id, timestamp)
    return TemporalQueryResponse(
        entity_id=project_id, timestamp=timestamp, data=data
    )
