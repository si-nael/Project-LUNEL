import uuid
from datetime import datetime

from sqlalchemy import String, Boolean, ForeignKey, Enum as SAEnum, UniqueConstraint, Uuid, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.database import Base
from app.models.enums import GroupType, MembershipRole


class Group(Base):
    __tablename__ = "groups"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    type: Mapped[GroupType] = mapped_column(
        SAEnum(GroupType, name="group_type_enum", create_constraint=True),
        nullable=False,
    )
    owner_user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id"), nullable=False
    )
    visibility_policy_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("visibility_policies.id"), nullable=True
    )
    is_temporary: Mapped[bool] = mapped_column(Boolean, default=False)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    owner = relationship("User", back_populates="owned_groups", lazy="selectin")
    memberships = relationship(
        "GroupMembership", back_populates="group", lazy="selectin"
    )


class GroupMembership(Base):
    __tablename__ = "group_memberships"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id"), nullable=False
    )
    group_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("groups.id"), nullable=False
    )
    membership_role: Mapped[MembershipRole] = mapped_column(
        SAEnum(MembershipRole, name="membership_role_enum", create_constraint=True),
        default=MembershipRole.MEMBER,
    )
    joined_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    __table_args__ = (UniqueConstraint("user_id", "group_id", name="uq_user_group"),)

    # Relationships
    user = relationship("User", back_populates="memberships", lazy="selectin")
    group = relationship("Group", back_populates="memberships", lazy="selectin")
