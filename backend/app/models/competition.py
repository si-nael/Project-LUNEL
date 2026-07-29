import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    String, Integer, SmallInteger, Text, Boolean, Numeric,
    ForeignKey, Enum as SAEnum, UniqueConstraint, Uuid, JSON, DateTime,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.database import Base
from app.models.enums import (
    ParticipantStatus,
    SubmissionVerdict,
    SyncJobType,
    SyncJobStatus,
)


class Competition(Base):
    __tablename__ = "competitions"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4
    )
    event_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("events.id"), nullable=False
    )
    max_participants: Mapped[int | None] = mapped_column(Integer, nullable=True)
    scoring_rule: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    opens_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    closes_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    freeze_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    scoreboard_public: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    event = relationship("Event", lazy="selectin")
    participants = relationship("Participant", back_populates="competition", lazy="selectin")
    problems = relationship(
        "CompetitionProblem",
        back_populates="competition",
        cascade="all, delete-orphan",
        lazy="selectin",
        order_by="CompetitionProblem.order_index",
    )


class Participant(Base):
    __tablename__ = "participants"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4
    )
    competition_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("competitions.id"), nullable=False
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id"), nullable=False
    )
    registered_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    status: Mapped[ParticipantStatus] = mapped_column(
        SAEnum(ParticipantStatus, name="participant_status_enum", create_constraint=True),
        default=ParticipantStatus.REGISTERED,
    )

    __table_args__ = (
        UniqueConstraint("competition_id", "user_id", name="uq_competition_user"),
    )

    # Relationships
    competition = relationship("Competition", back_populates="participants", lazy="selectin")
    user = relationship("User", lazy="selectin")


class Submission(Base):
    __tablename__ = "submissions"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4
    )
    competition_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("competitions.id"), nullable=False
    )
    participant_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("participants.id"), nullable=False
    )
    competition_problem_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("competition_problems.id"), nullable=True
    )
    content: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    language: Mapped[str | None] = mapped_column(String(50), nullable=True)
    source_code: Mapped[str | None] = mapped_column(Text, nullable=True)
    verdict: Mapped[SubmissionVerdict] = mapped_column(
        SAEnum(
            SubmissionVerdict,
            name="submission_verdict_enum",
            create_constraint=True,
        ),
        default=SubmissionVerdict.PENDING,
        server_default=SubmissionVerdict.PENDING.value,
    )
    score: Mapped[Decimal | None] = mapped_column(Numeric, nullable=True)
    penalty: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    execution_time_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    memory_kb: Mapped[int | None] = mapped_column(Integer, nullable=True)
    judge_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    result_detail: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    submitted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    graded_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    judged_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Relationships
    competition = relationship("Competition", lazy="selectin")
    participant = relationship("Participant", lazy="selectin")
    competition_problem = relationship("CompetitionProblem", lazy="selectin")


class Scoreboard(Base):
    __tablename__ = "scoreboards"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4
    )
    competition_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("competitions.id"), nullable=False
    )
    snapshot_data: Mapped[dict] = mapped_column(JSON, nullable=False)
    is_final: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    competition = relationship("Competition", lazy="selectin")


class SyncJob(Base):
    __tablename__ = "sync_jobs"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4
    )
    event_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("events.id"), nullable=False
    )
    job_type: Mapped[SyncJobType] = mapped_column(
        SAEnum(SyncJobType, name="sync_job_type_enum", create_constraint=True),
        nullable=False,
    )
    status: Mapped[SyncJobStatus] = mapped_column(
        SAEnum(SyncJobStatus, name="sync_job_status_enum", create_constraint=True),
        default=SyncJobStatus.PENDING,
    )
    result_summary: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    event = relationship("Event", lazy="selectin")
