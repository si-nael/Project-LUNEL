"""
Temporary group lifecycle management.

In production this would be called from a Celery periodic task:
    @celery_app.task
    def deactivate_expired_groups():
        asyncio.run(_deactivate_expired_groups())

For now, expose as an async function that can be called from
an admin endpoint or a cron-like scheduler.
"""
from datetime import datetime, timezone

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.group import Group


async def deactivate_expired_groups(db: AsyncSession) -> int:
    """
    Soft-deactivate all temporary groups past their expires_at.

    Returns the number of deactivated groups.
    """
    now = datetime.now(timezone.utc)

    result = await db.execute(
        select(Group).where(
            Group.is_temporary.is_(True),
            Group.is_active.is_(True),
            Group.expires_at.isnot(None),
            Group.expires_at <= now,
        )
    )
    expired = result.scalars().all()

    if not expired:
        return 0

    ids = [g.id for g in expired]
    await db.execute(
        update(Group)
        .where(Group.id.in_(ids))
        .values(is_active=False)
    )
    await db.flush()

    return len(ids)
