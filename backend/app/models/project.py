import uuid
from datetime import datetime

from sqlalchemy import String, SmallInteger, Text, ForeignKey, Enum as SAEnum, CheckConstraint, Uuid, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.database import Base
from app.models.enums import ProjectStatus


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4
    )
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    owner_group_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("groups.id"), nullable=False
    )
    progress_percent: Mapped[int] = mapped_column(SmallInteger, default=0)
    status: Mapped[ProjectStatus] = mapped_column(
        SAEnum(ProjectStatus, name="project_status_enum", create_constraint=True),
        default=ProjectStatus.DRAFT,
    )
    visibility_policy_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        ForeignKey("visibility_policies.id"),
        nullable=True,
    )
    created_by: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    __table_args__ = (
        CheckConstraint(
            "progress_percent >= 0 AND progress_percent <= 100",
            name="ck_project_progress",
        ),
    )

    # Relationships
    owner_group = relationship("Group", lazy="selectin")
    creator = relationship("User", lazy="selectin")
    visibility_policy = relationship("VisibilityPolicy", lazy="selectin")
    schedules = relationship("Schedule", back_populates="project", lazy="selectin")
