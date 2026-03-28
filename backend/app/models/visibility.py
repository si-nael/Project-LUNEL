import uuid
from datetime import datetime

from sqlalchemy import String, Boolean, Enum as SAEnum, Uuid, JSON
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.database import Base
from app.models.enums import VisibilityScopeType


class VisibilityPolicy(Base):
    __tablename__ = "visibility_policies"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4
    )
    scope_type: Mapped[VisibilityScopeType] = mapped_column(
        SAEnum(
            VisibilityScopeType,
            name="visibility_scope_enum",
            create_constraint=True,
        ),
        nullable=False,
    )
    allow_public: Mapped[bool] = mapped_column(Boolean, default=False)
    allow_group_ids: Mapped[list | None] = mapped_column(
        JSON, nullable=True
    )
    allow_role_names: Mapped[list | None] = mapped_column(
        JSON, nullable=True
    )
    deny_group_ids: Mapped[list | None] = mapped_column(
        JSON, nullable=True
    )
    rule_expression_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        server_default=func.now(), nullable=False
    )
