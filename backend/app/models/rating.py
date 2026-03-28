import uuid
from datetime import datetime

from sqlalchemy import SmallInteger, Text, ForeignKey, UniqueConstraint, CheckConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.database import Base


class Rating(Base):
    __tablename__ = "ratings"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4
    )
    schedule_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("schedules.id"), nullable=False
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id"), nullable=False
    )
    score: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    usefulness_score: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    importance_feedback: Mapped[int | None] = mapped_column(
        SmallInteger, nullable=True
    )
    comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), nullable=False
    )

    __table_args__ = (
        UniqueConstraint("schedule_id", "user_id", name="uq_schedule_user_rating"),
        CheckConstraint("score >= 1 AND score <= 5", name="ck_rating_score"),
        CheckConstraint(
            "usefulness_score IS NULL OR (usefulness_score >= 1 AND usefulness_score <= 5)",
            name="ck_rating_usefulness",
        ),
        CheckConstraint(
            "importance_feedback IS NULL OR (importance_feedback >= 1 AND importance_feedback <= 5)",
            name="ck_rating_importance",
        ),
    )

    # Relationships
    schedule = relationship("Schedule", back_populates="ratings", lazy="selectin")
    user = relationship("User", lazy="selectin")
