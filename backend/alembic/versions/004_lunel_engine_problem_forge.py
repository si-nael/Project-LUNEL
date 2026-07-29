"""Lunel engine state and Polygon-style problem forge

Revision ID: 004
Revises: 94e402c43bfa
Create Date: 2026-07-29
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "004"
down_revision: Union[str, None] = "94e402c43bfa"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


problem_status = postgresql.ENUM(
    "DRAFT", "REVIEW", "READY", "PUBLISHED", "ARCHIVED",
    name="problem_status_enum",
    create_type=False,
)
checker_type = postgresql.ENUM(
    "EXACT", "TOKENS", "FLOAT", "SPECIAL", "INTERACTIVE", "MANUAL",
    name="checker_type_enum",
    create_type=False,
)
problem_scoring_mode = postgresql.ENUM(
    "BINARY", "SUBTASK", "OUTPUT_ONLY", "MANUAL",
    name="problem_scoring_mode_enum",
    create_type=False,
)
submission_verdict = postgresql.ENUM(
    "PENDING", "QUEUED", "RUNNING", "ACCEPTED", "PARTIAL",
    "WRONG_ANSWER", "TIME_LIMIT", "MEMORY_LIMIT", "RUNTIME_ERROR",
    "COMPILE_ERROR", "JUDGE_ERROR", "MANUAL_REVIEW",
    name="submission_verdict_enum",
    create_type=False,
)


def upgrade() -> None:
    bind = op.get_bind()
    problem_status.create(bind, checkfirst=True)
    checker_type.create(bind, checkfirst=True)
    problem_scoring_mode.create(bind, checkfirst=True)
    submission_verdict.create(bind, checkfirst=True)

    op.add_column("competitions", sa.Column("opens_at", sa.DateTime(timezone=True)))
    op.add_column("competitions", sa.Column("closes_at", sa.DateTime(timezone=True)))
    op.add_column("competitions", sa.Column("freeze_at", sa.DateTime(timezone=True)))
    op.add_column(
        "competitions",
        sa.Column("scoreboard_public", sa.Boolean(), server_default=sa.text("true"), nullable=False),
    )

    op.add_column(
        "activity_nodes",
        sa.Column("assigned_user_id", sa.Uuid(), nullable=True),
    )
    op.add_column("activity_nodes", sa.Column("available_at", sa.DateTime(timezone=True)))
    op.add_column("activity_nodes", sa.Column("due_at", sa.DateTime(timezone=True)))
    op.add_column("activity_nodes", sa.Column("completed_at", sa.DateTime(timezone=True)))
    op.add_column(
        "activity_nodes",
        sa.Column("version", sa.Integer(), server_default="1", nullable=False),
    )
    op.create_foreign_key(
        "fk_activity_nodes_assigned_user",
        "activity_nodes",
        "users",
        ["assigned_user_id"],
        ["id"],
    )

    op.create_table(
        "problems",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("slug", sa.String(120), nullable=False),
        sa.Column("title", sa.String(300), nullable=False),
        sa.Column("statement_md", sa.Text(), server_default="", nullable=False),
        sa.Column("input_format_md", sa.Text(), server_default="", nullable=False),
        sa.Column("output_format_md", sa.Text(), server_default="", nullable=False),
        sa.Column("constraints_md", sa.Text(), server_default="", nullable=False),
        sa.Column("notes_md", sa.Text(), server_default="", nullable=False),
        sa.Column("time_limit_ms", sa.Integer(), server_default="2000", nullable=False),
        sa.Column("memory_limit_mb", sa.Integer(), server_default="512", nullable=False),
        sa.Column("checker_type", checker_type, server_default="TOKENS", nullable=False),
        sa.Column(
            "scoring_mode",
            problem_scoring_mode,
            server_default="BINARY",
            nullable=False,
        ),
        sa.Column("status", problem_status, server_default="DRAFT", nullable=False),
        sa.Column("difficulty", sa.Integer()),
        sa.Column("version", sa.Integer(), server_default="1", nullable=False),
        sa.Column("created_by", sa.Uuid(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column(
            "visibility_policy_id",
            sa.Uuid(),
            sa.ForeignKey("visibility_policies.id"),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.UniqueConstraint("slug", name="uq_problems_slug"),
    )
    op.create_index("ix_problems_slug", "problems", ["slug"])

    op.create_table(
        "problem_revisions",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "problem_id",
            sa.Uuid(),
            sa.ForeignKey("problems.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("snapshot_data", sa.JSON(), nullable=False),
        sa.Column("note", sa.String(500)),
        sa.Column("created_by", sa.Uuid(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.UniqueConstraint(
            "problem_id", "version", name="uq_problem_revision_version"
        ),
    )

    op.create_table(
        "problem_test_groups",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "problem_id",
            sa.Uuid(),
            sa.ForeignKey("problems.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("points", sa.Numeric(8, 2), server_default="100", nullable=False),
        sa.Column("order_index", sa.Integer(), server_default="0", nullable=False),
        sa.Column(
            "dependency_group_ids",
            sa.JSON(),
            server_default=sa.text("'[]'::json"),
            nullable=False,
        ),
        sa.Column("scoring_policy", sa.JSON()),
    )

    op.create_table(
        "problem_test_cases",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "group_id",
            sa.Uuid(),
            sa.ForeignKey("problem_test_groups.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("input_data", sa.Text(), server_default="", nullable=False),
        sa.Column("expected_output", sa.Text(), server_default="", nullable=False),
        sa.Column(
            "is_sample", sa.Boolean(), server_default=sa.text("false"), nullable=False
        ),
        sa.Column("points", sa.Numeric(8, 2)),
        sa.Column("order_index", sa.Integer(), server_default="0", nullable=False),
        sa.Column("metadata_json", sa.JSON()),
    )

    op.create_table(
        "problem_solutions",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "problem_id",
            sa.Uuid(),
            sa.ForeignKey("problems.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("language", sa.String(50), nullable=False),
        sa.Column("source_code", sa.Text(), nullable=False),
        sa.Column("expected_complexity", sa.String(120)),
        sa.Column(
            "is_reference", sa.Boolean(), server_default=sa.text("false"), nullable=False
        ),
        sa.Column("author_id", sa.Uuid(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )

    op.create_table(
        "competition_problems",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "competition_id",
            sa.Uuid(),
            sa.ForeignKey("competitions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("problem_id", sa.Uuid(), sa.ForeignKey("problems.id"), nullable=False),
        sa.Column("label", sa.String(20), nullable=False),
        sa.Column("title_override", sa.String(300)),
        sa.Column("points", sa.Numeric(8, 2), server_default="100", nullable=False),
        sa.Column("order_index", sa.Integer(), server_default="0", nullable=False),
        sa.Column("opens_at", sa.DateTime(timezone=True)),
        sa.Column("closes_at", sa.DateTime(timezone=True)),
        sa.Column("workflow_node_id", sa.Uuid(), sa.ForeignKey("activity_nodes.id")),
        sa.Column("scoring_config", sa.JSON()),
        sa.UniqueConstraint(
            "competition_id", "problem_id", name="uq_competition_problem"
        ),
        sa.UniqueConstraint(
            "competition_id", "label", name="uq_competition_problem_label"
        ),
    )

    op.add_column(
        "submissions",
        sa.Column("competition_problem_id", sa.Uuid(), nullable=True),
    )
    op.add_column("submissions", sa.Column("language", sa.String(50)))
    op.add_column("submissions", sa.Column("source_code", sa.Text()))
    op.add_column(
        "submissions",
        sa.Column(
            "verdict",
            submission_verdict,
            server_default="PENDING",
            nullable=False,
        ),
    )
    op.add_column(
        "submissions",
        sa.Column("penalty", sa.Integer(), server_default="0", nullable=False),
    )
    op.add_column("submissions", sa.Column("execution_time_ms", sa.Integer()))
    op.add_column("submissions", sa.Column("memory_kb", sa.Integer()))
    op.add_column("submissions", sa.Column("judge_message", sa.Text()))
    op.add_column("submissions", sa.Column("result_detail", sa.JSON()))
    op.add_column("submissions", sa.Column("judged_at", sa.DateTime(timezone=True)))
    op.create_foreign_key(
        "fk_submissions_competition_problem",
        "submissions",
        "competition_problems",
        ["competition_problem_id"],
        ["id"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_submissions_competition_problem", "submissions", type_="foreignkey"
    )
    for column in (
        "judged_at",
        "result_detail",
        "judge_message",
        "memory_kb",
        "execution_time_ms",
        "penalty",
        "verdict",
        "source_code",
        "language",
        "competition_problem_id",
    ):
        op.drop_column("submissions", column)

    op.drop_table("competition_problems")
    op.drop_table("problem_solutions")
    op.drop_table("problem_test_cases")
    op.drop_table("problem_test_groups")
    op.drop_table("problem_revisions")
    op.drop_index("ix_problems_slug", table_name="problems")
    op.drop_table("problems")

    op.drop_constraint(
        "fk_activity_nodes_assigned_user", "activity_nodes", type_="foreignkey"
    )
    for column in (
        "version",
        "completed_at",
        "due_at",
        "available_at",
        "assigned_user_id",
    ):
        op.drop_column("activity_nodes", column)
    for column in ("scoreboard_public", "freeze_at", "closes_at", "opens_at"):
        op.drop_column("competitions", column)

    bind = op.get_bind()
    submission_verdict.drop(bind, checkfirst=True)
    problem_scoring_mode.drop(bind, checkfirst=True)
    checker_type.drop(bind, checkfirst=True)
    problem_status.drop(bind, checkfirst=True)
