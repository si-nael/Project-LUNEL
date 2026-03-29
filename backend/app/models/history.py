import uuid
from datetime import datetime

from sqlalchemy import ForeignKey, Enum as SAEnum, Uuid, JSON, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.database import Base
from app.models.enums import ChangeType


class ScheduleHistory(Base):
    __tablename__ = "schedule_history"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4
    )
    schedule_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("schedules.id"), nullable=False
    )
    changed_by: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id"), nullable=False
    )
    change_type: Mapped[ChangeType] = mapped_column(
        SAEnum(ChangeType, name="change_type_enum", create_constraint=True),
        nullable=False,
    )
    previous_data: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    new_data: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    changed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    schedule = relationship("Schedule", lazy="selectin")
    user = relationship("User", lazy="selectin")


class ProjectHistory(Base):
    __tablename__ = "project_history"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4
    )
    project_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("projects.id"), nullable=False
    )
    changed_by: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id"), nullable=False
    )
    change_type: Mapped[ChangeType] = mapped_column(
        SAEnum(ChangeType, name="change_type_enum", create_constraint=True),
        nullable=False,
    )
    previous_data: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    new_data: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    changed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    project = relationship("Project", lazy="selectin")
    user = relationship("User", lazy="selectin")
