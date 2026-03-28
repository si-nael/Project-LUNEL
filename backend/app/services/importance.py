from datetime import datetime, timezone
from math import ceil

from sqlalchemy import select, func as sa_func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.schedule import Schedule
from app.models.rating import Rating


def calculate_urgency_weight(end_at: datetime | None) -> int:
    if end_at is None:
        return 0
    now = datetime.now(timezone.utc)
    delta = (end_at - now).total_seconds() / 86400  # days
    if delta < 0:
        return 0
    return min(20, max(0, ceil(20 - delta * 2)))


async def recalculate_importance(db: AsyncSession, schedule: Schedule) -> None:
    # Recalculate feedback_weight from ratings
    result = await db.execute(
        select(sa_func.avg(Rating.score)).where(Rating.schedule_id == schedule.id)
    )
    avg_score = result.scalar()
    if avg_score is not None:
        # Map 1-5 avg score to 0-20 weight
        schedule.feedback_weight = int((avg_score - 1) * 5)
    else:
        schedule.feedback_weight = 0

    # Recalculate urgency
    schedule.urgency_weight = calculate_urgency_weight(schedule.end_at)

    # Final score
    schedule.importance_score = (
        schedule.base_importance
        + schedule.authority_weight
        + schedule.feedback_weight
        + schedule.urgency_weight
        + schedule.dependency_weight
    )
