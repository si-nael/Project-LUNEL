import uuid
from datetime import datetime

from sqlalchemy import String, ForeignKey, Enum as SAEnum, Uuid
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.database import Base
from app.models.enums import EventType, EventStatus, SyncState, EventLinkType


class Event(Base):
    __tablename__ = "events"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4
    )
    event_type: Mapped[EventType] = mapped_column(
        SAEnum(EventType, name="event_type_enum", create_constraint=True),
        nullable=False,
    )
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    status: Mapped[EventStatus] = mapped_column(
        SAEnum(EventStatus, name="event_status_enum", create_constraint=True),
        default=EventStatus.PLANNED,
    )
    external_source_type: Mapped[str | None] = mapped_column(
        String(50), nullable=True
    )
    external_source_id: Mapped[str | None] = mapped_column(
        String(200), nullable=True
    )
    result_sync_state: Mapped[SyncState] = mapped_column(
        SAEnum(SyncState, name="sync_state_enum", create_constraint=True),
        default=SyncState.NOT_SYNCED,
    )
    created_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), onupdate=func.now(), nullable=False
    )


class ScheduleEventLink(Base):
    __tablename__ = "schedule_event_links"

    schedule_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("schedules.id"),
        primary_key=True,
    )
    event_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("events.id"),
        primary_key=True,
    )
    link_type: Mapped[EventLinkType] = mapped_column(
        SAEnum(EventLinkType, name="event_link_type_enum", create_constraint=True),
        nullable=False,
    )
