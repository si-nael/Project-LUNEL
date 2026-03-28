import uuid
from datetime import datetime

from sqlalchemy import (
    String, SmallInteger, Text, Boolean, ForeignKey,
    Enum as SAEnum, Uuid, JSON,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.database import Base
from app.models.enums import ScheduleType, ScheduleSubtype, ScheduleStatus


class Schedule(Base):
    __tablename__ = "schedules"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4
    )
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    type: Mapped[ScheduleType] = mapped_column(
        SAEnum(ScheduleType, name="schedule_type_enum", create_constraint=True),
        nullable=False,
    )
    subtype: Mapped[ScheduleSubtype] = mapped_column(
        SAEnum(ScheduleSubtype, name="schedule_subtype_enum", create_constraint=True),
        nullable=False,
    )
    start_at: Mapped[datetime] = mapped_column(nullable=False)
    end_at: Mapped[datetime | None] = mapped_column(nullable=True)
    all_day: Mapped[bool] = mapped_column(Boolean, default=False)
    timezone: Mapped[str] = mapped_column(String(50), default="Asia/Seoul")
    status: Mapped[ScheduleStatus] = mapped_column(
        SAEnum(ScheduleStatus, name="schedule_status_enum", create_constraint=True),
        default=ScheduleStatus.SCHEDULED,
    )

    # Importance fields
    importance_score: Mapped[int] = mapped_column(SmallInteger, default=50)
    base_importance: Mapped[int] = mapped_column(SmallInteger, default=50)
    authority_weight: Mapped[int] = mapped_column(SmallInteger, default=0)
    urgency_weight: Mapped[int] = mapped_column(SmallInteger, default=0)
    feedback_weight: Mapped[int] = mapped_column(SmallInteger, default=0)
    dependency_weight: Mapped[int] = mapped_column(SmallInteger, default=0)

    # Relations
    visibility_policy_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey("visibility_policies.id"),
        nullable=True,
    )
    creator_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id"), nullable=False
    )
    project_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("projects.id"), nullable=True
    )
    related_event_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("events.id"), nullable=True
    )

    location: Mapped[str | None] = mapped_column(String(200), nullable=True)
    metadata_json: Mapped[dict | None] = mapped_column(
        "metadata", JSON, nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), onupdate=func.now(), nullable=False
    )

    # Relationships
    creator = relationship("User", lazy="selectin")
    project = relationship("Project", back_populates="schedules", lazy="selectin")
    visibility_policy = relationship("VisibilityPolicy", lazy="selectin")
    event = relationship("Event", lazy="selectin")
    ratings = relationship("Rating", back_populates="schedule", lazy="selectin")
