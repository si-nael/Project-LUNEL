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

    # If status changed to DONE, set progress to 100
    if data.status == "DONE":
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

    edge = ActivityEdge(
        from_node_id=data.from_node_id,
        to_node_id=data.to_node_id,
        edge_type=data.edge_type,
    )
    db.add(edge)
    await db.flush()
    await db.refresh(edge)
    return edge


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
