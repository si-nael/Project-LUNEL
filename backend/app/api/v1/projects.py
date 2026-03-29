from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.deps import get_current_user
from app.database import get_db
from app.models.project import Project
from app.models.user import User
from app.models.enums import ChangeType
from app.schemas.project import ProjectCreate, ProjectResponse, ProjectUpdate
from app.services.visibility import can_user_access
from app.services.history import record_project_change, _project_to_dict

router = APIRouter()


@router.post("", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_project(
    data: ProjectCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = Project(
        title=data.title,
        description=data.description,
        owner_group_id=data.owner_group_id,
        status=data.status,
        visibility_policy_id=data.visibility_policy_id,
        created_by=current_user.id,
    )
    db.add(project)
    await db.flush()
    await db.refresh(project)

    await record_project_change(db, project, current_user.id, ChangeType.CREATE)

    return project


@router.get("", response_model=list[ProjectResponse])
async def list_projects(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Project))
    projects = result.scalars().all()

    accessible = []
    for p in projects:
        if p.visibility_policy_id is None or await can_user_access(
            db, current_user, p.visibility_policy_id
        ):
            accessible.append(p)
    return accessible


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = await db.get(Project, project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")

    if project.visibility_policy_id and not await can_user_access(
        db, current_user, project.visibility_policy_id
    ):
        raise HTTPException(status_code=403, detail="Access denied")

    return project


@router.patch("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: UUID,
    data: ProjectUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project = await db.get(Project, project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")

    if project.created_by != current_user.id and current_user.role.value not in ("ADMIN", "TEACHER"):
        raise HTTPException(status_code=403, detail="Not authorized to edit")

    previous_data = _project_to_dict(project)

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(project, field, value)

    await db.flush()
    await db.refresh(project)

    await record_project_change(
        db, project, current_user.id, ChangeType.UPDATE, previous_data=previous_data,
    )

    return project
