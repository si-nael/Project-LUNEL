"""DAG service: cycle detection (DFS), topological sort, critical path."""
from collections import defaultdict
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.activity import ActivityNode, ActivityEdge
from app.models.enums import EdgeType


async def _build_adjacency(
    db: AsyncSession, project_id: UUID
) -> tuple[dict[UUID, list[UUID]], set[UUID]]:
    """Build adjacency list from DEPENDS_ON and BLOCKS edges within a project."""
    nodes_result = await db.execute(
        select(ActivityNode.id).where(ActivityNode.project_id == project_id)
    )
    node_ids = set(nodes_result.scalars().all())

    edges_result = await db.execute(
        select(ActivityEdge).where(
            ActivityEdge.from_node_id.in_(node_ids),
            ActivityEdge.to_node_id.in_(node_ids),
            ActivityEdge.edge_type.in_([EdgeType.DEPENDS_ON, EdgeType.BLOCKS]),
        )
    )
    edges = edges_result.scalars().all()

    adj: dict[UUID, list[UUID]] = defaultdict(list)
    for e in edges:
        adj[e.from_node_id].append(e.to_node_id)

    return adj, node_ids


async def has_cycle(db: AsyncSession, project_id: UUID) -> bool:
    """Check if project's DAG contains a cycle using DFS."""
    adj, node_ids = await _build_adjacency(db, project_id)

    WHITE, GRAY, BLACK = 0, 1, 2
    color: dict[UUID, int] = {nid: WHITE for nid in node_ids}

    def dfs(node: UUID) -> bool:
        color[node] = GRAY
        for neighbor in adj.get(node, []):
            if color[neighbor] == GRAY:
                return True
            if color[neighbor] == WHITE and dfs(neighbor):
                return True
        color[node] = BLACK
        return False

    for nid in node_ids:
        if color[nid] == WHITE and dfs(nid):
            return True
    return False


async def would_create_cycle(
    db: AsyncSession, project_id: UUID, from_node_id: UUID, to_node_id: UUID
) -> bool:
    """Check if adding edge from_node -> to_node would create a cycle."""
    adj, node_ids = await _build_adjacency(db, project_id)
    adj[from_node_id].append(to_node_id)

    WHITE, GRAY, BLACK = 0, 1, 2
    color: dict[UUID, int] = {nid: WHITE for nid in node_ids}

    def dfs(node: UUID) -> bool:
        color[node] = GRAY
        for neighbor in adj.get(node, []):
            if color[neighbor] == GRAY:
                return True
            if color[neighbor] == WHITE and dfs(neighbor):
                return True
        color[node] = BLACK
        return False

    for nid in node_ids:
        if color[nid] == WHITE and dfs(nid):
            return True
    return False


async def topological_sort(db: AsyncSession, project_id: UUID) -> list[UUID]:
    """Return node IDs in topological order (Kahn's algorithm).
    Raises ValueError if graph has a cycle.
    """
    adj, node_ids = await _build_adjacency(db, project_id)

    in_degree: dict[UUID, int] = {nid: 0 for nid in node_ids}
    for src, neighbors in adj.items():
        for dst in neighbors:
            in_degree[dst] = in_degree.get(dst, 0) + 1

    queue = [nid for nid in node_ids if in_degree[nid] == 0]
    result: list[UUID] = []

    while queue:
        queue.sort()  # deterministic ordering
        node = queue.pop(0)
        result.append(node)
        for neighbor in adj.get(node, []):
            in_degree[neighbor] -= 1
            if in_degree[neighbor] == 0:
                queue.append(neighbor)

    if len(result) != len(node_ids):
        raise ValueError("Graph contains a cycle; topological sort not possible")

    return result


async def get_dag_layers(db: AsyncSession, project_id: UUID) -> list[list[UUID]]:
    """Group nodes into layers for visualization (longest-path layering)."""
    adj, node_ids = await _build_adjacency(db, project_id)

    in_degree: dict[UUID, int] = {nid: 0 for nid in node_ids}
    for src, neighbors in adj.items():
        for dst in neighbors:
            in_degree[dst] = in_degree.get(dst, 0) + 1

    layer_map: dict[UUID, int] = {}
    queue = [nid for nid in node_ids if in_degree[nid] == 0]
    for nid in queue:
        layer_map[nid] = 0

    visited = set()
    while queue:
        node = queue.pop(0)
        visited.add(node)
        for neighbor in adj.get(node, []):
            layer_map[neighbor] = max(
                layer_map.get(neighbor, 0), layer_map[node] + 1
            )
            in_degree[neighbor] -= 1
            if in_degree[neighbor] == 0:
                queue.append(neighbor)

    if len(visited) != len(node_ids):
        raise ValueError("Graph contains a cycle")

    layers: dict[int, list[UUID]] = defaultdict(list)
    for nid, layer in layer_map.items():
        layers[layer].append(nid)

    return [layers[i] for i in range(max(layers.keys()) + 1)] if layers else []
