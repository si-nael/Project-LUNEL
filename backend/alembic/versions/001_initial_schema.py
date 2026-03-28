"""Initial schema - Phase 1

Revision ID: 001
Revises:
Create Date: 2026-03-29
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, ARRAY, JSONB

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Enums
    user_role = sa.Enum("STUDENT", "TEACHER", "ADMIN", "EXTERNAL", name="user_role_enum")
    group_type = sa.Enum("SCHOOL", "GRADE", "CLASS", "CLUB", "PROJECT_TEAM", "TEMPORARY", "STAFF", name="group_type_enum")
    membership_role = sa.Enum("OWNER", "ADMIN", "MEMBER", "VIEWER", name="membership_role_enum")
    visibility_scope = sa.Enum("PUBLIC", "AUTHENTICATED", "GROUP_ONLY", "ROLE_ONLY", "GROUP_AND_ROLE", "PROCEDURAL_KEY", name="visibility_scope_enum")
    project_status = sa.Enum("DRAFT", "ACTIVE", "PAUSED", "COMPLETED", "ARCHIVED", name="project_status_enum")
    schedule_type = sa.Enum("PROJECT", "INTERVAL", "EVENT", name="schedule_type_enum")
    schedule_subtype = sa.Enum(
        "PERSONAL_PROJECT", "TEAM_PROJECT", "TEMP_GROUP_PROJECT",
        "REGISTRATION_WINDOW", "EVENT_WINDOW", "SUBMISSION_WINDOW",
        "COMPETITION", "PERFORMANCE_TASK", "ASSIGNMENT", "MEETING", "GENERAL_EVENT",
        name="schedule_subtype_enum",
    )
    schedule_status = sa.Enum("DRAFT", "SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED", name="schedule_status_enum")
    event_type = sa.Enum("COMPETITION", "EXHIBITION", "CHALLENGE", "WORKSHOP", "OTHER", name="event_type_enum")
    event_status = sa.Enum("PLANNED", "REGISTRATION_OPEN", "IN_PROGRESS", "JUDGING", "COMPLETED", "CANCELLED", name="event_status_enum")
    sync_state = sa.Enum("NOT_SYNCED", "SYNCING", "SYNCED", "ERROR", name="sync_state_enum")
    event_link_type = sa.Enum("MAIN", "REGISTRATION", "RESULT", "RELATED", name="event_link_type_enum")

    # users
    op.create_table(
        "users",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("email", sa.String(255), unique=True, nullable=False),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("role", user_role, nullable=False),
        sa.Column("class_info", sa.String(50), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # groups
    op.create_table(
        "groups",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("type", group_type, nullable=False),
        sa.Column("owner_user_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("is_temporary", sa.Boolean(), server_default=sa.text("false")),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # group_memberships
    op.create_table(
        "group_memberships",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("group_id", UUID(as_uuid=True), sa.ForeignKey("groups.id"), nullable=False),
        sa.Column("membership_role", membership_role, server_default="MEMBER"),
        sa.Column("joined_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("user_id", "group_id", name="uq_user_group"),
    )

    # visibility_policies
    op.create_table(
        "visibility_policies",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("scope_type", visibility_scope, nullable=False),
        sa.Column("allow_public", sa.Boolean(), server_default=sa.text("false")),
        sa.Column("allow_group_ids", ARRAY(UUID(as_uuid=True)), nullable=True),
        sa.Column("allow_role_names", ARRAY(sa.String()), nullable=True),
        sa.Column("deny_group_ids", ARRAY(UUID(as_uuid=True)), nullable=True),
        sa.Column("rule_expression_json", JSONB, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # projects
    op.create_table(
        "projects",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("title", sa.String(300), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("owner_group_id", UUID(as_uuid=True), sa.ForeignKey("groups.id"), nullable=False),
        sa.Column("progress_percent", sa.SmallInteger(), server_default="0"),
        sa.Column("status", project_status, server_default="DRAFT"),
        sa.Column("visibility_policy_id", UUID(as_uuid=True), sa.ForeignKey("visibility_policies.id"), nullable=True),
        sa.Column("created_by", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.CheckConstraint("progress_percent >= 0 AND progress_percent <= 100", name="ck_project_progress"),
    )

    # events
    op.create_table(
        "events",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("event_type", event_type, nullable=False),
        sa.Column("title", sa.String(300), nullable=False),
        sa.Column("status", event_status, server_default="PLANNED"),
        sa.Column("external_source_type", sa.String(50), nullable=True),
        sa.Column("external_source_id", sa.String(200), nullable=True),
        sa.Column("result_sync_state", sync_state, server_default="NOT_SYNCED"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # schedules
    op.create_table(
        "schedules",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("title", sa.String(300), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("type", schedule_type, nullable=False),
        sa.Column("subtype", schedule_subtype, nullable=False),
        sa.Column("start_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("end_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("all_day", sa.Boolean(), server_default=sa.text("false")),
        sa.Column("timezone", sa.String(50), server_default="Asia/Seoul"),
        sa.Column("status", schedule_status, server_default="SCHEDULED"),
        sa.Column("importance_score", sa.SmallInteger(), server_default="50"),
        sa.Column("base_importance", sa.SmallInteger(), server_default="50"),
        sa.Column("authority_weight", sa.SmallInteger(), server_default="0"),
        sa.Column("urgency_weight", sa.SmallInteger(), server_default="0"),
        sa.Column("feedback_weight", sa.SmallInteger(), server_default="0"),
        sa.Column("dependency_weight", sa.SmallInteger(), server_default="0"),
        sa.Column("visibility_policy_id", UUID(as_uuid=True), sa.ForeignKey("visibility_policies.id"), nullable=True),
        sa.Column("creator_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("project_id", UUID(as_uuid=True), sa.ForeignKey("projects.id"), nullable=True),
        sa.Column("related_event_id", UUID(as_uuid=True), sa.ForeignKey("events.id"), nullable=True),
        sa.Column("location", sa.String(200), nullable=True),
        sa.Column("metadata", JSONB, nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # schedule_event_links
    op.create_table(
        "schedule_event_links",
        sa.Column("schedule_id", UUID(as_uuid=True), sa.ForeignKey("schedules.id"), primary_key=True),
        sa.Column("event_id", UUID(as_uuid=True), sa.ForeignKey("events.id"), primary_key=True),
        sa.Column("link_type", event_link_type, nullable=False),
    )

    # ratings
    op.create_table(
        "ratings",
        sa.Column("id", UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("schedule_id", UUID(as_uuid=True), sa.ForeignKey("schedules.id"), nullable=False),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("score", sa.SmallInteger(), nullable=False),
        sa.Column("usefulness_score", sa.SmallInteger(), nullable=True),
        sa.Column("importance_feedback", sa.SmallInteger(), nullable=True),
        sa.Column("comment", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("schedule_id", "user_id", name="uq_schedule_user_rating"),
        sa.CheckConstraint("score >= 1 AND score <= 5", name="ck_rating_score"),
        sa.CheckConstraint("usefulness_score IS NULL OR (usefulness_score >= 1 AND usefulness_score <= 5)", name="ck_rating_usefulness"),
        sa.CheckConstraint("importance_feedback IS NULL OR (importance_feedback >= 1 AND importance_feedback <= 5)", name="ck_rating_importance"),
    )

    # Indexes
    op.create_index("ix_schedules_type", "schedules", ["type"])
    op.create_index("ix_schedules_subtype", "schedules", ["subtype"])
    op.create_index("ix_schedules_start_at", "schedules", ["start_at"])
    op.create_index("ix_schedules_importance", "schedules", ["importance_score"])
    op.create_index("ix_schedules_project_id", "schedules", ["project_id"])
    op.create_index("ix_schedules_creator_id", "schedules", ["creator_id"])
    op.create_index("ix_ratings_schedule_id", "ratings", ["schedule_id"])
    op.create_index("ix_group_memberships_user", "group_memberships", ["user_id"])
    op.create_index("ix_group_memberships_group", "group_memberships", ["group_id"])


def downgrade() -> None:
    op.drop_table("ratings")
    op.drop_table("schedule_event_links")
    op.drop_table("schedules")
    op.drop_table("events")
    op.drop_table("projects")
    op.drop_table("visibility_policies")
    op.drop_table("group_memberships")
    op.drop_table("groups")
    op.drop_table("users")

    for enum_name in [
        "user_role_enum", "group_type_enum", "membership_role_enum",
        "visibility_scope_enum", "project_status_enum",
        "schedule_type_enum", "schedule_subtype_enum", "schedule_status_enum",
        "event_type_enum", "event_status_enum", "sync_state_enum", "event_link_type_enum",
    ]:
        sa.Enum(name=enum_name).drop(op.get_bind(), checkfirst=True)
