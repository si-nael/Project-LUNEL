"""History service: event sourcing for schedules and projects."""
from datetime import datetime
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import ChangeType
from app.models.history import ScheduleHistory, ProjectHistory
from app.models.schedule import Schedule
from app.models.project import Project


def _schedule_to_dict(schedule: Schedule) -> dict:
    return {
        "title": schedule.title,
        "description": schedule.description,
        "type": schedule.type.value if schedule.type else None,
        "subtype": schedule.subtype.value if schedule.subtype else None,
        "start_at": schedule.start_at.isoformat() if schedule.start_at else None,
        "end_at": schedule.end_at.isoformat() if schedule.end_at else None,
        "all_day": schedule.all_day,
        "status": schedule.status.value if schedule.status else None,
        "importance_score": schedule.importance_score,
        "base_importance": schedule.base_importance,
        "location": schedule.location,
    }


def _project_to_dict(project: Project) -> dict:
    return {
        "title": project.title,
        "description": project.description,
        "status": project.status.value if project.status else None,
        "progress_percent": project.progress_percent,
    }


async def record_schedule_change(
    db: AsyncSession,
    schedule: Schedule,
    changed_by: UUID,
    change_type: ChangeType,
    previous_data: dict | None = None,
) -> ScheduleHistory:
    new_data = _schedule_to_dict(schedule) if change_type != ChangeType.DELETE else None
    entry = ScheduleHistory(
        schedule_id=schedule.id,
        changed_by=changed_by,
        change_type=change_type,
        previous_data=previous_data,
        new_data=new_data,
    )
    db.add(entry)
    await db.flush()
    await db.refresh(entry)
    return entry


async def record_project_change(
    db: AsyncSession,
    project: Project,
    changed_by: UUID,
    change_type: ChangeType,
    previous_data: dict | None = None,
) -> ProjectHistory:
    new_data = _project_to_dict(project) if change_type != ChangeType.DELETE else None
    entry = ProjectHistory(
        project_id=project.id,
        changed_by=changed_by,
        change_type=change_type,
        previous_data=previous_data,
        new_data=new_data,
    )
    db.add(entry)
    await db.flush()
    await db.refresh(entry)
    return entry


async def get_schedule_history(
    db: AsyncSession, schedule_id: UUID
) -> list[ScheduleHistory]:
    result = await db.execute(
        select(ScheduleHistory)
        .where(ScheduleHistory.schedule_id == schedule_id)
        .order_by(ScheduleHistory.changed_at.desc())
    )
    return list(result.scalars().all())


async def get_project_history(
    db: AsyncSession, project_id: UUID
) -> list[ProjectHistory]:
    result = await db.execute(
        select(ProjectHistory)
        .where(ProjectHistory.project_id == project_id)
        .order_by(ProjectHistory.changed_at.desc())
    )
    return list(result.scalars().all())


async def get_schedule_at(
    db: AsyncSession, schedule_id: UUID, timestamp: datetime
) -> dict | None:
    """Reconstruct schedule state at a given point in time.

    Finds the latest history entry at or before the timestamp and returns
    its new_data snapshot.
    """
    result = await db.execute(
        select(ScheduleHistory)
        .where(
            ScheduleHistory.schedule_id == schedule_id,
            ScheduleHistory.changed_at <= timestamp,
        )
        .order_by(ScheduleHistory.changed_at.desc())
        .limit(1)
    )
    entry = result.scalar_one_or_none()
    if entry is None:
        return None
    if entry.change_type == ChangeType.DELETE:
        return None
    return entry.new_data


async def get_project_at(
    db: AsyncSession, project_id: UUID, timestamp: datetime
) -> dict | None:
    """Reconstruct project state at a given point in time."""
    result = await db.execute(
        select(ProjectHistory)
        .where(
            ProjectHistory.project_id == project_id,
            ProjectHistory.changed_at <= timestamp,
        )
        .order_by(ProjectHistory.changed_at.desc())
        .limit(1)
    )
    entry = result.scalar_one_or_none()
    if entry is None:
        return None
    if entry.change_type == ChangeType.DELETE:
        return None
    return entry.new_data
