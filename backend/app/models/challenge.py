import uuid
from datetime import datetime

from sqlalchemy import String, ForeignKey, Enum as SAEnum, Uuid, JSON, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.database import Base
from app.models.enums import ChallengeStatus


class Challenge(Base):
    __tablename__ = "challenges"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4
    )
    visibility_policy_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("visibility_policies.id"), nullable=False
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id"), nullable=False
    )
    challenge_type: Mapped[str] = mapped_column(String(50), nullable=False)
    challenge_data: Mapped[dict] = mapped_column(JSON, nullable=False)
    expected_answer_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[ChallengeStatus] = mapped_column(
        SAEnum(ChallengeStatus, name="challenge_status_enum", create_constraint=True),
        default=ChallengeStatus.PENDING,
    )
    attempts: Mapped[int] = mapped_column(default=0)
    max_attempts: Mapped[int] = mapped_column(default=3)
    expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    visibility_policy = relationship("VisibilityPolicy", lazy="selectin")
    user = relationship("User", lazy="selectin")
