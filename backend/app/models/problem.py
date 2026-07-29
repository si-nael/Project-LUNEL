import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum as SAEnum,
    ForeignKey,
    Integer,
    JSON,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    Uuid,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.database import Base
from app.models.enums import CheckerType, ProblemScoringMode, ProblemStatus


class Problem(Base):
    """Reusable Polygon-style problem package.

    A problem is authored independently and then attached to one or more
    competitions through CompetitionProblem.
    """

    __tablename__ = "problems"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    slug: Mapped[str] = mapped_column(String(120), unique=True, nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    statement_md: Mapped[str] = mapped_column(Text, default="", server_default="")
    input_format_md: Mapped[str] = mapped_column(Text, default="", server_default="")
    output_format_md: Mapped[str] = mapped_column(Text, default="", server_default="")
    constraints_md: Mapped[str] = mapped_column(Text, default="", server_default="")
    notes_md: Mapped[str] = mapped_column(Text, default="", server_default="")
    time_limit_ms: Mapped[int] = mapped_column(Integer, default=2000, server_default="2000")
    memory_limit_mb: Mapped[int] = mapped_column(Integer, default=512, server_default="512")
    checker_type: Mapped[CheckerType] = mapped_column(
        SAEnum(CheckerType, name="checker_type_enum", create_constraint=True),
        default=CheckerType.TOKENS,
        server_default=CheckerType.TOKENS.value,
    )
    scoring_mode: Mapped[ProblemScoringMode] = mapped_column(
        SAEnum(
            ProblemScoringMode,
            name="problem_scoring_mode_enum",
            create_constraint=True,
        ),
        default=ProblemScoringMode.BINARY,
        server_default=ProblemScoringMode.BINARY.value,
    )
    status: Mapped[ProblemStatus] = mapped_column(
        SAEnum(ProblemStatus, name="problem_status_enum", create_constraint=True),
        default=ProblemStatus.DRAFT,
        server_default=ProblemStatus.DRAFT.value,
    )
    difficulty: Mapped[int | None] = mapped_column(Integer, nullable=True)
    version: Mapped[int] = mapped_column(Integer, default=1, server_default="1")
    created_by: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id"), nullable=False
    )
    visibility_policy_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("visibility_policies.id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    creator = relationship("User", lazy="selectin")
    visibility_policy = relationship("VisibilityPolicy", lazy="selectin")
    test_groups = relationship(
        "ProblemTestGroup",
        back_populates="problem",
        cascade="all, delete-orphan",
        lazy="selectin",
        order_by="ProblemTestGroup.order_index",
    )
    solutions = relationship(
        "ProblemSolution",
        back_populates="problem",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    revisions = relationship(
        "ProblemRevision",
        back_populates="problem",
        cascade="all, delete-orphan",
        lazy="selectin",
        order_by="ProblemRevision.version.desc()",
    )


class ProblemRevision(Base):
    __tablename__ = "problem_revisions"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    problem_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("problems.id", ondelete="CASCADE"), nullable=False
    )
    version: Mapped[int] = mapped_column(Integer, nullable=False)
    snapshot_data: Mapped[dict] = mapped_column(JSON, nullable=False)
    note: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_by: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    __table_args__ = (
        UniqueConstraint("problem_id", "version", name="uq_problem_revision_version"),
    )

    problem = relationship("Problem", back_populates="revisions")
    creator = relationship("User", lazy="selectin")


class ProblemTestGroup(Base):
    __tablename__ = "problem_test_groups"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    problem_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("problems.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    points: Mapped[Decimal] = mapped_column(
        Numeric(8, 2), default=lambda: Decimal("100")
    )
    order_index: Mapped[int] = mapped_column(Integer, default=0)
    dependency_group_ids: Mapped[list] = mapped_column(JSON, default=list)
    scoring_policy: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    problem = relationship("Problem", back_populates="test_groups")
    test_cases = relationship(
        "ProblemTestCase",
        back_populates="group",
        cascade="all, delete-orphan",
        lazy="selectin",
        order_by="ProblemTestCase.order_index",
    )


class ProblemTestCase(Base):
    __tablename__ = "problem_test_cases"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    group_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("problem_test_groups.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    input_data: Mapped[str] = mapped_column(Text, default="", server_default="")
    expected_output: Mapped[str] = mapped_column(Text, default="", server_default="")
    is_sample: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    points: Mapped[Decimal | None] = mapped_column(Numeric(8, 2), nullable=True)
    order_index: Mapped[int] = mapped_column(Integer, default=0)
    metadata_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    group = relationship("ProblemTestGroup", back_populates="test_cases")


class ProblemSolution(Base):
    __tablename__ = "problem_solutions"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    problem_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("problems.id", ondelete="CASCADE"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    language: Mapped[str] = mapped_column(String(50), nullable=False)
    source_code: Mapped[str] = mapped_column(Text, nullable=False)
    expected_complexity: Mapped[str | None] = mapped_column(String(120), nullable=True)
    is_reference: Mapped[bool] = mapped_column(Boolean, default=False)
    author_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    problem = relationship("Problem", back_populates="solutions")
    author = relationship("User", lazy="selectin")


class CompetitionProblem(Base):
    """A problem release inside a competition.

    The optional workflow node connects problem release to the Lunel engine:
    a problem can become visible only after its prerequisite activity is ready.
    """

    __tablename__ = "competition_problems"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    competition_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("competitions.id", ondelete="CASCADE"), nullable=False
    )
    problem_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("problems.id"), nullable=False
    )
    label: Mapped[str] = mapped_column(String(20), nullable=False)
    title_override: Mapped[str | None] = mapped_column(String(300), nullable=True)
    points: Mapped[Decimal] = mapped_column(
        Numeric(8, 2), default=lambda: Decimal("100")
    )
    order_index: Mapped[int] = mapped_column(Integer, default=0)
    opens_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    closes_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    workflow_node_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("activity_nodes.id"), nullable=True
    )
    scoring_config: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    __table_args__ = (
        UniqueConstraint("competition_id", "problem_id", name="uq_competition_problem"),
        UniqueConstraint("competition_id", "label", name="uq_competition_problem_label"),
    )

    competition = relationship("Competition", back_populates="problems")
    problem = relationship("Problem", lazy="selectin")
    workflow_node = relationship("ActivityNode", lazy="selectin")
