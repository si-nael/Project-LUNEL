import uuid
from datetime import datetime

from sqlalchemy import (
    String, SmallInteger, Integer, ForeignKey, Float,
    Enum as SAEnum, UniqueConstraint, Uuid, DateTime,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.database import Base
from app.models.enums import NodeType, NodeStatus, EdgeType


class ActivityNode(Base):
    __tablename__ = "activity_nodes"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4
    )
    project_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("projects.id"), nullable=False
    )
    parent_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("activity_nodes.id"), nullable=True
    )
    related_schedule_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid, ForeignKey("schedules.id"), nullable=True
    )
    node_type: Mapped[NodeType] = mapped_column(
        SAEnum(NodeType, name="node_type_enum", create_constraint=True),
        nullable=False,
    )
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    status: Mapped[NodeStatus] = mapped_column(
        SAEnum(NodeStatus, name="node_status_enum", create_constraint=True),
        default=NodeStatus.TODO,
    )
    progress: Mapped[int] = mapped_column(SmallInteger, default=0)
    order_index: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    
    # EV Simulator Fields
    cost_hours: Mapped[float] = mapped_column(Float, default=0.0, server_default="0.0")
    success_probability: Mapped[float] = mapped_column(Float, default=1.0, server_default="1.0")
    reward_points: Mapped[float] = mapped_column(Float, default=0.0, server_default="0.0")

    # Relationships
    project = relationship("Project", lazy="selectin")
    parent = relationship("ActivityNode", remote_side=[id], lazy="selectin")
    children = relationship("ActivityNode", back_populates="parent", lazy="selectin")
    schedule = relationship("Schedule", lazy="selectin")


class ActivityEdge(Base):
    __tablename__ = "activity_edges"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4
    )
    from_node_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("activity_nodes.id"), nullable=False
    )
    to_node_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("activity_nodes.id"), nullable=False
    )
    edge_type: Mapped[EdgeType] = mapped_column(
        SAEnum(EdgeType, name="edge_type_enum", create_constraint=True),
        nullable=False,
    )

    __table_args__ = (
        UniqueConstraint("from_node_id", "to_node_id", "edge_type", name="uq_edge"),
    )

    # Relationships
    from_node = relationship("ActivityNode", foreign_keys=[from_node_id], lazy="selectin")
    to_node = relationship("ActivityNode", foreign_keys=[to_node_id], lazy="selectin")
