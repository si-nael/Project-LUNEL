"""Authoritative state-machine projection for Lunel project workflows."""
from collections import defaultdict
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.activity import ActivityEdge, ActivityNode
from app.models.enums import EdgeType, NodeStatus
from app.timeutils import as_utc


ALLOWED_TRANSITIONS: dict[NodeStatus, set[NodeStatus]] = {
    NodeStatus.TODO: {NodeStatus.IN_PROGRESS, NodeStatus.BLOCKED},
    NodeStatus.IN_PROGRESS: {NodeStatus.TODO, NodeStatus.DONE, NodeStatus.BLOCKED},
    NodeStatus.BLOCKED: {NodeStatus.TODO, NodeStatus.IN_PROGRESS},
    NodeStatus.DONE: {NodeStatus.IN_PROGRESS},
}


async def load_project_graph(
    db: AsyncSession, project_id: UUID
) -> tuple[list[ActivityNode], list[ActivityEdge]]:
    nodes_result = await db.execute(
        select(ActivityNode)
        .where(ActivityNode.project_id == project_id)
        .order_by(ActivityNode.order_index, ActivityNode.created_at)
    )
    nodes = nodes_result.scalars().all()
    ids = [node.id for node in nodes]
    if not ids:
        return nodes, []
    edges_result = await db.execute(
        select(ActivityEdge).where(
            ActivityEdge.from_node_id.in_(ids),
            ActivityEdge.to_node_id.in_(ids),
        )
    )
    return nodes, edges_result.scalars().all()


def project_state_projection(
    nodes: list[ActivityNode],
    edges: list[ActivityEdge],
    *,
    user_id: UUID | None = None,
) -> dict:
    node_map = {node.id: node for node in nodes}
    prerequisites: dict[UUID, list[UUID]] = defaultdict(list)
    successors: dict[UUID, list[UUID]] = defaultdict(list)
    for edge in edges:
        if edge.edge_type in (EdgeType.DEPENDS_ON, EdgeType.BLOCKS):
            prerequisites[edge.to_node_id].append(edge.from_node_id)
            successors[edge.from_node_id].append(edge.to_node_id)

    now = datetime.now(timezone.utc)
    projected_nodes: list[dict] = []
    ready_count = 0
    blocked_count = 0
    overdue_count = 0

    for node in nodes:
        blocked_by = [
            prereq_id
            for prereq_id in prerequisites.get(node.id, [])
            if node_map.get(prereq_id)
            and node_map[prereq_id].status != NodeStatus.DONE
        ]
        available_at = as_utc(node.available_at)
        due_at = as_utc(node.due_at)
        time_ready = available_at is None or available_at <= now
        ready = (
            node.status == NodeStatus.TODO
            and not blocked_by
            and time_ready
        )
        overdue = (
            due_at is not None
            and due_at < now
            and node.status != NodeStatus.DONE
        )
        visible_for_user = user_id is None or node.assigned_user_id in (None, user_id)
        if ready and visible_for_user:
            ready_count += 1
        if blocked_by or node.status == NodeStatus.BLOCKED:
            blocked_count += 1
        if overdue:
            overdue_count += 1

        projected_nodes.append(
            {
                "id": str(node.id),
                "title": node.title,
                "type": node.node_type.value,
                "status": node.status.value,
                "progress": node.progress,
                "assigned_user_id": (
                    str(node.assigned_user_id) if node.assigned_user_id else None
                ),
                "available_at": (
                    node.available_at.isoformat() if node.available_at else None
                ),
                "due_at": node.due_at.isoformat() if node.due_at else None,
                "completed_at": (
                    node.completed_at.isoformat() if node.completed_at else None
                ),
                "ready": ready,
                "overdue": overdue,
                "blocked_by": [str(value) for value in blocked_by],
                "unlocks": [str(value) for value in successors.get(node.id, [])],
                "version": node.version,
            }
        )

    total_progress = (
        round(sum(node.progress for node in nodes) / len(nodes)) if nodes else 0
    )
    return {
        "summary": {
            "total": len(nodes),
            "ready": ready_count,
            "blocked": blocked_count,
            "overdue": overdue_count,
            "progress": total_progress,
        },
        "nodes": projected_nodes,
        "edges": [
            {
                "id": str(edge.id),
                "from": str(edge.from_node_id),
                "to": str(edge.to_node_id),
                "type": edge.edge_type.value,
            }
            for edge in edges
        ],
    }


async def transition_node(
    db: AsyncSession,
    node: ActivityNode,
    target: NodeStatus,
    *,
    expected_version: int | None = None,
) -> ActivityNode:
    if expected_version is not None and node.version != expected_version:
        raise ValueError("다른 사용자가 먼저 수정했습니다. 최신 상태를 다시 불러오세요.")
    if target == node.status:
        return node
    if target not in ALLOWED_TRANSITIONS[node.status]:
        raise ValueError(f"{node.status.value}에서 {target.value}(으)로 전환할 수 없습니다.")

    if target in (NodeStatus.IN_PROGRESS, NodeStatus.DONE):
        prereq_result = await db.execute(
            select(ActivityNode)
            .join(ActivityEdge, ActivityEdge.from_node_id == ActivityNode.id)
            .where(
                ActivityEdge.to_node_id == node.id,
                ActivityEdge.edge_type.in_([EdgeType.DEPENDS_ON, EdgeType.BLOCKS]),
            )
        )
        incomplete = [
            prereq.title
            for prereq in prereq_result.scalars().all()
            if prereq.status != NodeStatus.DONE
        ]
        if incomplete:
            raise ValueError("선행 활동이 완료되지 않았습니다: " + ", ".join(incomplete))

    node.status = target
    node.version += 1
    if target == NodeStatus.DONE:
        node.progress = 100
        node.completed_at = datetime.now(timezone.utc)
    elif node.completed_at is not None:
        node.completed_at = None
    await db.flush()
    return node
