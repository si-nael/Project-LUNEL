"""
Notification service — creates notifications triggered by system events.

Usage:
    from app.services.notifications import notify_deadline_approaching
    await notify_deadline_approaching(db, schedule)
"""
import uuid
from datetime import datetime, timezone, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.notification import Notification
from app.models.schedule import Schedule
from app.models.group import GroupMembership


async def create_notification(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    type: str,
    title: str,
    body: str | None = None,
    related_schedule_id: uuid.UUID | None = None,
    related_project_id: uuid.UUID | None = None,
) -> Notification:
    notif = Notification(
        user_id=user_id,
        type=type,
        title=title,
        body=body,
        related_schedule_id=related_schedule_id,
        related_project_id=related_project_id,
    )
    db.add(notif)
    await db.flush()
    return notif


async def notify_deadline_approaching(
    db: AsyncSession,
    schedule: Schedule,
    *,
    hours_before: int = 24,
) -> list[Notification]:
    """Create notifications for users when a schedule deadline is approaching."""
    notifications = []
    notif = await create_notification(
        db,
        user_id=schedule.creator_id,
        type="DEADLINE",
        title=f"마감 임박: {schedule.title}",
        body=f"{hours_before}시간 후 마감됩니다.",
        related_schedule_id=schedule.id,
    )
    notifications.append(notif)
    return notifications


async def notify_schedule_changed(
    db: AsyncSession,
    schedule: Schedule,
    changed_by: uuid.UUID,
) -> list[Notification]:
    """Notify the schedule creator when their schedule is modified."""
    notifications = []
    if schedule.creator_id != changed_by:
        notif = await create_notification(
            db,
            user_id=schedule.creator_id,
            type="SCHEDULE_CHANGE",
            title=f"일정 변경: {schedule.title}",
            body="일정 정보가 수정되었습니다.",
            related_schedule_id=schedule.id,
        )
        notifications.append(notif)
    return notifications


async def notify_rating_received(
    db: AsyncSession,
    schedule: Schedule,
    rater_name: str,
) -> list[Notification]:
    """Notify the schedule creator when a new rating is received."""
    notif = await create_notification(
        db,
        user_id=schedule.creator_id,
        type="RATING_RECEIVED",
        title=f"새 평가: {schedule.title}",
        body=f"{rater_name}님이 평가했습니다.",
        related_schedule_id=schedule.id,
    )
    return [notif]


async def notify_group_invite(
    db: AsyncSession,
    user_id: uuid.UUID,
    group_name: str,
) -> Notification:
    """Notify a user when they are added to a group."""
    return await create_notification(
        db,
        user_id=user_id,
        type="GROUP_INVITE",
        title=f"그룹 초대: {group_name}",
        body=f"'{group_name}' 그룹에 추가되었습니다.",
    )


async def notify_result_confirmed(
    db: AsyncSession,
    user_id: uuid.UUID,
    event_title: str,
    related_schedule_id: uuid.UUID | None = None,
) -> Notification:
    """Notify a user when event results are confirmed."""
    return await create_notification(
        db,
        user_id=user_id,
        type="RESULT_CONFIRMED",
        title=f"결과 확정: {event_title}",
        body="이벤트 결과가 확정되었습니다.",
        related_schedule_id=related_schedule_id,
    )
