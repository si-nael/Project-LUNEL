"""Phase 2 - Activity nodes, competitions, notifications

Revision ID: 002
Revises: 001
Create Date: 2026-03-29
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Enums
    node_type = sa.Enum("MILESTONE", "TASK", "SUB_TASK", name="node_type_enum")
    node_status = sa.Enum("TODO", "IN_PROGRESS", "DONE", "BLOCKED", name="node_status_enum")
    edge_type = sa.Enum("HIERARCHY", "DEPENDS_ON", "BLOCKS", "REFERS_TO", name="edge_type_enum")
    participant_status = sa.Enum("REGISTERED", "CONFIRMED", "WITHDRAWN", name="participant_status_enum")
    sync_job_type = sa.Enum("MANUAL", "POLLING", "WEBHOOK", name="sync_job_type_enum")
    sync_job_status = sa.Enum("PENDING", "RUNNING", "SUCCESS", "FAILED", name="sync_job_status_enum")

    # activity_nodes
    op.create_table(
        "activity_nodes",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("project_id", UUID(as_uuid=True), sa.ForeignKey("projects.id"), nullable=False),
        sa.Column("parent_id", UUID(as_uuid=True), sa.ForeignKey("activity_nodes.id"), nullable=True),
        sa.Column("related_schedule_id", UUID(as_uuid=True), sa.ForeignKey("schedules.id"), nullable=True),
        sa.Column("node_type", node_type, nullable=False),
        sa.Column("title", sa.String(300), nullable=False),
        sa.Column("status", node_status, server_default="TODO"),
        sa.Column("progress", sa.SmallInteger(), server_default="0"),
        sa.Column("order_index", sa.Integer(), server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # activity_edges
    op.create_table(
        "activity_edges",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("from_node_id", UUID(as_uuid=True), sa.ForeignKey("activity_nodes.id"), nullable=False),
        sa.Column("to_node_id", UUID(as_uuid=True), sa.ForeignKey("activity_nodes.id"), nullable=False),
        sa.Column("edge_type", edge_type, nullable=False),
        sa.UniqueConstraint("from_node_id", "to_node_id", "edge_type", name="uq_edge"),
    )

    # competitions
    op.create_table(
        "competitions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("event_id", UUID(as_uuid=True), sa.ForeignKey("events.id"), nullable=False),
        sa.Column("max_participants", sa.Integer(), nullable=True),
        sa.Column("scoring_rule", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # participants
    op.create_table(
        "participants",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("competition_id", UUID(as_uuid=True), sa.ForeignKey("competitions.id"), nullable=False),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("registered_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("status", participant_status, server_default="REGISTERED"),
        sa.UniqueConstraint("competition_id", "user_id", name="uq_competition_user"),
    )

    # submissions
    op.create_table(
        "submissions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("competition_id", UUID(as_uuid=True), sa.ForeignKey("competitions.id"), nullable=False),
        sa.Column("participant_id", UUID(as_uuid=True), sa.ForeignKey("participants.id"), nullable=False),
        sa.Column("content", sa.JSON(), nullable=True),
        sa.Column("score", sa.Numeric(), nullable=True),
        sa.Column("submitted_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("graded_at", sa.DateTime(timezone=True), nullable=True),
    )

    # scoreboards
    op.create_table(
        "scoreboards",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("competition_id", UUID(as_uuid=True), sa.ForeignKey("competitions.id"), nullable=False),
        sa.Column("snapshot_data", sa.JSON(), nullable=False),
        sa.Column("is_final", sa.Boolean(), server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # sync_jobs
    op.create_table(
        "sync_jobs",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("event_id", UUID(as_uuid=True), sa.ForeignKey("events.id"), nullable=False),
        sa.Column("job_type", sync_job_type, nullable=False),
        sa.Column("status", sync_job_status, server_default="PENDING"),
        sa.Column("result_summary", sa.JSON(), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # notifications
    op.create_table(
        "notifications",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("type", sa.String(50), nullable=False),
        sa.Column("title", sa.String(300), nullable=False),
        sa.Column("body", sa.Text(), nullable=True),
        sa.Column("related_schedule_id", UUID(as_uuid=True), sa.ForeignKey("schedules.id"), nullable=True),
        sa.Column("related_project_id", UUID(as_uuid=True), sa.ForeignKey("projects.id"), nullable=True),
        sa.Column("is_read", sa.Boolean(), server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Indexes
    op.create_index("ix_activity_nodes_project", "activity_nodes", ["project_id"])
    op.create_index("ix_activity_nodes_parent", "activity_nodes", ["parent_id"])
    op.create_index("ix_notifications_user", "notifications", ["user_id"])
    op.create_index("ix_notifications_unread", "notifications", ["user_id", "is_read"])
    op.create_index("ix_participants_competition", "participants", ["competition_id"])


def downgrade() -> None:
    op.drop_table("notifications")
    op.drop_table("sync_jobs")
    op.drop_table("scoreboards")
    op.drop_table("submissions")
    op.drop_table("participants")
    op.drop_table("competitions")
    op.drop_table("activity_edges")
    op.drop_table("activity_nodes")

    for enum_name in [
        "node_type_enum", "node_status_enum", "edge_type_enum",
        "participant_status_enum", "sync_job_type_enum", "sync_job_status_enum",
    ]:
        sa.Enum(name=enum_name).drop(op.get_bind(), checkfirst=True)
