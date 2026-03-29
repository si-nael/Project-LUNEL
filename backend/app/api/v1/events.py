from uuid import UUID
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.deps import get_current_user
from app.database import get_db
from app.models.event import Event
from app.models.competition import SyncJob
from app.models.enums import SyncState, SyncJobType, SyncJobStatus
from app.models.user import User
from app.schemas.event import (
    EventCreate, EventUpdate, EventResponse, SyncJobResponse,
)

router = APIRouter()


@router.post("", response_model=EventResponse, status_code=status.HTTP_201_CREATED)
async def create_event(
    body: EventCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    event = Event(
        event_type=body.event_type,
        title=body.title,
        external_source_type=body.external_source_type,
        external_source_id=body.external_source_id,
    )
    db.add(event)
    await db.flush()
    await db.refresh(event)
    return event


@router.get("", response_model=list[EventResponse])
async def list_events(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Event).order_by(Event.created_at.desc())
    )
    return result.scalars().all()


@router.get("/{event_id}", response_model=EventResponse)
async def get_event(
    event_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    event = await db.get(Event, event_id)
    if event is None:
        raise HTTPException(status_code=404, detail="Event not found")
    return event


@router.patch("/{event_id}", response_model=EventResponse)
async def update_event(
    event_id: UUID,
    body: EventUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    event = await db.get(Event, event_id)
    if event is None:
        raise HTTPException(status_code=404, detail="Event not found")

    update_data = body.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(event, key, value)

    await db.flush()
    await db.refresh(event)
    return event


@router.post(
    "/{event_id}/sync",
    response_model=SyncJobResponse,
    status_code=status.HTTP_201_CREATED,
)
async def sync_event(
    event_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a manual sync job for the event results."""
    event = await db.get(Event, event_id)
    if event is None:
        raise HTTPException(status_code=404, detail="Event not found")

    # Mark event as syncing
    event.result_sync_state = SyncState.SYNCING

    job = SyncJob(
        event_id=event.id,
        job_type=SyncJobType.MANUAL,
        status=SyncJobStatus.PENDING,
    )
    db.add(job)
    await db.flush()

    # v1: Mark as success immediately (no external system yet)
    job.status = SyncJobStatus.SUCCESS
    job.started_at = datetime.now(timezone.utc)
    job.completed_at = datetime.now(timezone.utc)
    job.result_summary = {"message": "Manual sync placeholder — no external system configured"}
    event.result_sync_state = SyncState.SYNCED

    await db.flush()
    await db.refresh(job)
    return job


@router.get("/{event_id}/sync-jobs", response_model=list[SyncJobResponse])
async def list_sync_jobs(
    event_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(SyncJob)
        .where(SyncJob.event_id == event_id)
        .order_by(SyncJob.created_at.desc())
    )
    return result.scalars().all()
