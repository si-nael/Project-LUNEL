from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.deps import get_current_user
from app.database import get_db
from app.models.activity import ActivityNode, ActivityEdge
from app.models.project import Project
from app.models.user import User
from app.schemas.activity import (
    ActivityNodeCreate, ActivityNodeUpdate, ActivityNodeResponse,
    ActivityEdgeCreate, ActivityEdgeResponse,
)
from app.schemas.dag import DAGOrderResponse, DAGLayerResponse, CycleCheckResponse

router = APIRouter()


@router.get(
    "/projects/{project_id}/nodes",
    response_model=list[ActivityNodeResponse],
)
async def list_nodes(
    project_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = await db.get(Project, project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")

    result = await db.execute(
        select(ActivityNode)
        .where(ActivityNode.project_id == project_id)
        .order_by(ActivityNode.order_index)
    )
    return result.scalars().all()


@router.get(
    "/projects/{project_id}/edges",
    response_model=list[ActivityEdgeResponse],
)
async def list_edges(
    project_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = await db.get(Project, project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")

    result = await db.execute(
        select(ActivityEdge)
        .join(ActivityNode, ActivityEdge.from_node_id == ActivityNode.id)
        .where(ActivityNode.project_id == project_id)
    )
    return result.scalars().all()


@router.post(
    "/projects/{project_id}/nodes",
    response_model=ActivityNodeResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_node(
    project_id: UUID,
    data: ActivityNodeCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = await db.get(Project, project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")

    if data.parent_id:
        parent = await db.get(ActivityNode, data.parent_id)
        if parent is None or parent.project_id != project_id:
            raise HTTPException(status_code=400, detail="Invalid parent node")

    node = ActivityNode(
        project_id=project_id,
        parent_id=data.parent_id,
        related_schedule_id=data.related_schedule_id,
        node_type=data.node_type,
        title=data.title,
        order_index=data.order_index,
        cost_hours=data.cost_hours,
        success_probability=data.success_probability,
        reward_points=data.reward_points,
    )
    db.add(node)
    await db.flush()
    await db.refresh(node)
    return node


@router.patch(
    "/projects/{project_id}/nodes/{node_id}",
    response_model=ActivityNodeResponse,
)
async def update_node(
    project_id: UUID,
    node_id: UUID,
    data: ActivityNodeUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    node = await db.get(ActivityNode, node_id)
    if node is None or node.project_id != project_id:
        raise HTTPException(status_code=404, detail="Node not found")

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(node, key, value)

    # If status changed to DONE, check dependencies
    if data.status == "DONE":
        # Validation Engine: Check if all DEPENDS_ON prerequisites are DONE
        deps_result = await db.execute(
            select(ActivityNode).join(
                ActivityEdge, ActivityEdge.from_node_id == ActivityNode.id
            ).where(
                ActivityEdge.to_node_id == node.id,
                ActivityEdge.edge_type == "DEPENDS_ON"
            )
        )
        prerequisites = deps_result.scalars().all()
        for prereq in prerequisites:
            if prereq.status.name != "DONE":
                raise HTTPException(
                    status_code=400, 
                    detail=f"Cannot complete this task. Prerequisite '{prereq.title}' is not DONE."
                )
        node.progress = 100

    await db.flush()

    # Recalculate parent progress
    await _recalc_parent_progress(db, node)

    await db.refresh(node)
    return node


@router.delete(
    "/projects/{project_id}/nodes/{node_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_node(
    project_id: UUID,
    node_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    node = await db.get(ActivityNode, node_id)
    if node is None or node.project_id != project_id:
        raise HTTPException(status_code=404, detail="Node not found")

    # Check no children exist
    children = await db.execute(
        select(ActivityNode).where(ActivityNode.parent_id == node_id)
    )
    if children.scalars().first():
        raise HTTPException(status_code=409, detail="Cannot delete node with children")

    # Delete related edges
    await db.execute(
        select(ActivityEdge).where(
            (ActivityEdge.from_node_id == node_id) | (ActivityEdge.to_node_id == node_id)
        )
    )
    # Actually delete edges
    from sqlalchemy import delete as sa_delete
    await db.execute(
        sa_delete(ActivityEdge).where(
            (ActivityEdge.from_node_id == node_id) | (ActivityEdge.to_node_id == node_id)
        )
    )

    await db.delete(node)
    await db.flush()


@router.get(
    "/projects/{project_id}/tree",
    response_model=list[ActivityNodeResponse],
)
async def get_project_tree(
    project_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get all nodes for a project ordered for tree rendering."""
    project = await db.get(Project, project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")

    result = await db.execute(
        select(ActivityNode)
        .where(ActivityNode.project_id == project_id)
        .order_by(ActivityNode.order_index)
    )
    return result.scalars().all()


@router.post(
    "/projects/{project_id}/edges",
    response_model=ActivityEdgeResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_edge(
    project_id: UUID,
    data: ActivityEdgeCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Verify both nodes exist and belong to this project
    from_node = await db.get(ActivityNode, data.from_node_id)
    to_node = await db.get(ActivityNode, data.to_node_id)

    if not from_node or from_node.project_id != project_id:
        raise HTTPException(status_code=400, detail="Invalid from_node")
    if not to_node or to_node.project_id != project_id:
        raise HTTPException(status_code=400, detail="Invalid to_node")

    if data.from_node_id == data.to_node_id:
        raise HTTPException(status_code=400, detail="Self-loops not allowed")

    # Cycle detection for dependency edges
    if data.edge_type in ("DEPENDS_ON", "BLOCKS"):
        from app.services.dag import would_create_cycle
        if await would_create_cycle(db, project_id, data.from_node_id, data.to_node_id):
            raise HTTPException(
                status_code=400,
                detail="이 엣지를 추가하면 순환이 발생합니다.",
            )

    edge = ActivityEdge(
        from_node_id=data.from_node_id,
        to_node_id=data.to_node_id,
        edge_type=data.edge_type,
    )
    db.add(edge)
    await db.flush()
    await db.refresh(edge)
    return edge


@router.delete(
    "/projects/{project_id}/edges/{edge_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_edge(
    project_id: UUID,
    edge_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    edge = await db.get(ActivityEdge, edge_id)
    if edge is None:
        raise HTTPException(status_code=404, detail="Edge not found")

    # Verify edge belongs to this project
    from_node = await db.get(ActivityNode, edge.from_node_id)
    if from_node is None or from_node.project_id != project_id:
        raise HTTPException(status_code=404, detail="Edge not found in this project")

    await db.delete(edge)
    await db.flush()


async def _recalc_parent_progress(db: AsyncSession, node: ActivityNode):
    """Recalculate progress up the tree after a child node changes."""
    if node.parent_id is None:
        # Update project progress from root-level nodes
        result = await db.execute(
            select(ActivityNode).where(
                ActivityNode.project_id == node.project_id,
                ActivityNode.parent_id.is_(None),
            )
        )
        root_nodes = result.scalars().all()
        if root_nodes:
            avg = sum(n.progress for n in root_nodes) // len(root_nodes)
            project = await db.get(Project, node.project_id)
            if project:
                project.progress_percent = avg
        return

    parent = await db.get(ActivityNode, node.parent_id)
    if parent:
        result = await db.execute(
            select(ActivityNode).where(ActivityNode.parent_id == parent.id)
        )
        children = result.scalars().all()
        if children:
            parent.progress = sum(c.progress for c in children) // len(children)
        await _recalc_parent_progress(db, parent)


# --- DAG endpoints ---


@router.get(
    "/projects/{project_id}/dag-order",
    response_model=DAGOrderResponse,
)
async def get_dag_order(
    project_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get nodes in topological order for DAG visualization."""
    project = await db.get(Project, project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")

    from app.services.dag import topological_sort
    try:
        ordered = await topological_sort(db, project_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return DAGOrderResponse(project_id=project_id, ordered_node_ids=ordered)


@router.get(
    "/projects/{project_id}/dag-layers",
    response_model=DAGLayerResponse,
)
async def get_dag_layers_endpoint(
    project_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get nodes grouped into layers for DAG visualization."""
    project = await db.get(Project, project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")

    from app.services.dag import get_dag_layers
    try:
        layers = await get_dag_layers(db, project_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return DAGLayerResponse(project_id=project_id, layers=layers)


@router.get(
    "/projects/{project_id}/dag-check",
    response_model=CycleCheckResponse,
)
async def check_dag_cycle(
    project_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Check if project's activity graph contains cycles."""
    project = await db.get(Project, project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")

    from app.services.dag import has_cycle
    cycle = await has_cycle(db, project_id)
    return CycleCheckResponse(project_id=project_id, has_cycle=cycle)
