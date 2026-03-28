from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func as sa_func
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.deps import get_current_user
from app.database import get_db
from app.models.rating import Rating
from app.models.schedule import Schedule
from app.models.user import User
from app.schemas.rating import RatingCreate, RatingResponse, RatingSummary
from app.services.importance import recalculate_importance

router = APIRouter()


@router.post(
    "/schedules/{schedule_id}/ratings",
    response_model=RatingResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_rating(
    schedule_id: UUID,
    data: RatingCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    schedule = await db.get(Schedule, schedule_id)
    if schedule is None:
        raise HTTPException(status_code=404, detail="Schedule not found")

    # No self-rating
    if schedule.creator_id == current_user.id:
        raise HTTPException(status_code=403, detail="Cannot rate your own schedule")

    # Check duplicate
    result = await db.execute(
        select(Rating).where(
            Rating.schedule_id == schedule_id,
            Rating.user_id == current_user.id,
        )
    )
    if result.scalar_one_or_none() is not None:
        raise HTTPException(status_code=409, detail="Already rated this schedule")

    rating = Rating(
        schedule_id=schedule_id,
        user_id=current_user.id,
        score=data.score,
        usefulness_score=data.usefulness_score,
        importance_feedback=data.importance_feedback,
        comment=data.comment,
    )
    db.add(rating)
    await db.flush()

    # Recalculate schedule importance after new rating
    await recalculate_importance(db, schedule)
    await db.flush()

    await db.refresh(rating)
    return rating


@router.get(
    "/schedules/{schedule_id}/ratings-summary",
    response_model=RatingSummary,
)
async def get_ratings_summary(
    schedule_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    schedule = await db.get(Schedule, schedule_id)
    if schedule is None:
        raise HTTPException(status_code=404, detail="Schedule not found")

    result = await db.execute(
        select(
            sa_func.count(Rating.id).label("total"),
            sa_func.avg(Rating.score).label("avg_score"),
            sa_func.avg(Rating.usefulness_score).label("avg_usefulness"),
            sa_func.avg(Rating.importance_feedback).label("avg_importance"),
        ).where(Rating.schedule_id == schedule_id)
    )
    row = result.one()

    return RatingSummary(
        schedule_id=schedule_id,
        total_ratings=row.total or 0,
        avg_score=round(float(row.avg_score or 0), 2),
        avg_usefulness=round(float(row.avg_usefulness), 2) if row.avg_usefulness else None,
        avg_importance_feedback=round(float(row.avg_importance), 2) if row.avg_importance else None,
    )
