"""Phase 3 - History tables, challenges

Revision ID: 003
Revises: 002
Create Date: 2026-03-30
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Enums
    change_type = sa.Enum("CREATE", "UPDATE", "DELETE", name="change_type_enum")
    challenge_status = sa.Enum(
        "PENDING", "VERIFIED", "FAILED", "EXPIRED", name="challenge_status_enum"
    )

    # schedule_history
    op.create_table(
        "schedule_history",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "schedule_id",
            UUID(as_uuid=True),
            sa.ForeignKey("schedules.id"),
            nullable=False,
        ),
        sa.Column(
            "changed_by",
            UUID(as_uuid=True),
            sa.ForeignKey("users.id"),
            nullable=False,
        ),
        sa.Column("change_type", change_type, nullable=False),
        sa.Column("previous_data", sa.JSON, nullable=True),
        sa.Column("new_data", sa.JSON, nullable=True),
        sa.Column(
            "changed_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )

    # project_history
    op.create_table(
        "project_history",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "project_id",
            UUID(as_uuid=True),
            sa.ForeignKey("projects.id"),
            nullable=False,
        ),
        sa.Column(
            "changed_by",
            UUID(as_uuid=True),
            sa.ForeignKey("users.id"),
            nullable=False,
        ),
        sa.Column("change_type", change_type, nullable=False),
        sa.Column("previous_data", sa.JSON, nullable=True),
        sa.Column("new_data", sa.JSON, nullable=True),
        sa.Column(
            "changed_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )

    # challenges
    op.create_table(
        "challenges",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "visibility_policy_id",
            UUID(as_uuid=True),
            sa.ForeignKey("visibility_policies.id"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            UUID(as_uuid=True),
            sa.ForeignKey("users.id"),
            nullable=False,
        ),
        sa.Column("challenge_type", sa.String(50), nullable=False),
        sa.Column("challenge_data", sa.JSON, nullable=False),
        sa.Column("expected_answer_hash", sa.String(255), nullable=False),
        sa.Column("status", challenge_status, default="PENDING"),
        sa.Column("attempts", sa.Integer, default=0),
        sa.Column("max_attempts", sa.Integer, default=3),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_table("challenges")
    op.drop_table("project_history")
    op.drop_table("schedule_history")
    sa.Enum(name="challenge_status_enum").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="change_type_enum").drop(op.get_bind(), checkfirst=True)
