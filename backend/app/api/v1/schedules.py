from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.deps import get_current_user
from app.database import get_db
from app.models.schedule import Schedule
from app.models.user import User
from app.models.enums import ScheduleType, ScheduleSubtype, ScheduleStatus
from app.schemas.schedule import ScheduleCreate, ScheduleResponse, ScheduleUpdate
from app.services.importance import calculate_urgency_weight, recalculate_importance
from app.services.visibility import can_user_access
from app.services.history import record_schedule_change, _schedule_to_dict
from app.models.enums import ScheduleType, ScheduleSubtype, ScheduleStatus, ChangeType

router = APIRouter()


@router.post("", response_model=ScheduleResponse, status_code=status.HTTP_201_CREATED)
async def create_schedule(
    data: ScheduleCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    urgency = calculate_urgency_weight(data.end_at)
    importance_score = data.base_importance + data.authority_weight + urgency

    schedule = Schedule(
        title=data.title,
        description=data.description,
        type=data.type,
        subtype=data.subtype,
        start_at=data.start_at,
        end_at=data.end_at,
        all_day=data.all_day,
        timezone=data.timezone,
        base_importance=data.base_importance,
        authority_weight=data.authority_weight,
        urgency_weight=urgency,
        importance_score=importance_score,
        visibility_policy_id=data.visibility_policy_id,
        creator_id=current_user.id,
        project_id=data.project_id,
        related_event_id=data.related_event_id,
        location=data.location,
        metadata_json=data.metadata,
    )
    db.add(schedule)
    await db.flush()
    await db.refresh(schedule)

    await record_schedule_change(db, schedule, current_user.id, ChangeType.CREATE)

    return schedule


@router.get("", response_model=list[ScheduleResponse])
async def list_schedules(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    type: ScheduleType | None = None,
    subtype: ScheduleSubtype | None = None,
    project_id: UUID | None = None,
    status_filter: ScheduleStatus | None = Query(None, alias="status"),
    start_after: datetime | None = None,
    end_before: datetime | None = None,
    importance_min: int | None = None,
):
    conditions = []
    if type:
        conditions.append(Schedule.type == type)
    if subtype:
        conditions.append(Schedule.subtype == subtype)
    if project_id:
        conditions.append(Schedule.project_id == project_id)
    if status_filter:
        conditions.append(Schedule.status == status_filter)
    if start_after:
        conditions.append(Schedule.start_at >= start_after)
    if end_before:
        conditions.append(Schedule.end_at <= end_before)
    if importance_min:
        conditions.append(Schedule.importance_score >= importance_min)

    stmt = select(Schedule)
    if conditions:
        stmt = stmt.where(and_(*conditions))
    stmt = stmt.order_by(Schedule.importance_score.desc(), Schedule.start_at)

    result = await db.execute(stmt)
    schedules = result.scalars().all()

    # Filter by visibility
    accessible = []
    for s in schedules:
        if s.visibility_policy_id is None or await can_user_access(
            db, current_user, s.visibility_policy_id
        ):
            accessible.append(s)
    return accessible


@router.get("/{schedule_id}", response_model=ScheduleResponse)
async def get_schedule(
    schedule_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    schedule = await db.get(Schedule, schedule_id)
    if schedule is None:
        raise HTTPException(status_code=404, detail="Schedule not found")

    if schedule.visibility_policy_id and not await can_user_access(
        db, current_user, schedule.visibility_policy_id
    ):
        raise HTTPException(status_code=403, detail="Access denied")

    return schedule


@router.patch("/{schedule_id}", response_model=ScheduleResponse)
async def update_schedule(
    schedule_id: UUID,
    data: ScheduleUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    schedule = await db.get(Schedule, schedule_id)
    if schedule is None:
        raise HTTPException(status_code=404, detail="Schedule not found")

    if schedule.creator_id != current_user.id and current_user.role.value not in ("ADMIN", "TEACHER"):
        raise HTTPException(status_code=403, detail="Not authorized to edit")

    previous_data = _schedule_to_dict(schedule)

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if field == "metadata":
            setattr(schedule, "metadata_json", value)
        else:
            setattr(schedule, field, value)

    await recalculate_importance(db, schedule)
    await db.flush()
    await db.refresh(schedule)

    await record_schedule_change(
        db, schedule, current_user.id, ChangeType.UPDATE, previous_data=previous_data,
    )

    return schedule


@router.delete("/{schedule_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_schedule(
    schedule_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    schedule = await db.get(Schedule, schedule_id)
    if schedule is None:
        raise HTTPException(status_code=404, detail="Schedule not found")

    if schedule.creator_id != current_user.id and current_user.role.value not in ("ADMIN", "TEACHER"):
        raise HTTPException(status_code=403, detail="Not authorized to delete")

    await record_schedule_change(db, schedule, current_user.id, ChangeType.DELETE,
                                 previous_data=_schedule_to_dict(schedule))

    await db.delete(schedule)
