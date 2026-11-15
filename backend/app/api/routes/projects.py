from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import delete, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user
from app.core.database import get_db_session
from app.db.bootstrap import unique_slug
from app.db.models import Budget, Project, Run, User
from app.schemas.project import ProjectCreate, ProjectRead, ProjectUpdate

router = APIRouter(prefix="/projects", tags=["projects"])


@router.get("", response_model=list[ProjectRead])
async def list_projects(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> list[ProjectRead]:
    query = (
        select(Project)
        .options(selectinload(Project.budget))
        .where(Project.user_id == current_user.id)
        .order_by(Project.created_at.desc())
    )
    result = await session.execute(query)
    return list(result.scalars().unique())


@router.post("", response_model=ProjectRead)
async def create_project(
    payload: ProjectCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> ProjectRead:
    project = Project(
        user_id=current_user.id,
        name=payload.name,
        slug=unique_slug(payload.name),
        description=payload.description,
        objective=payload.objective,
        primary_model_profile_id=payload.primary_model_profile_id,
        critic_model_profile_id=payload.critic_model_profile_id,
        default_compute_target_id=payload.default_compute_target_id,
        settings=payload.settings,
    )
    session.add(project)
    await session.flush()
    session.add(
        Budget(
            project_id=project.id,
            max_cost_usd=payload.budget.max_cost_usd,
            max_runtime_minutes=payload.budget.max_runtime_minutes,
            max_tokens=payload.budget.max_tokens,
        )
    )
    await session.commit()
    await session.refresh(project, attribute_names=["budget"])
    return project


@router.get("/{project_id}", response_model=ProjectRead)
async def get_project(
    project_id: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> ProjectRead:
    result = await session.execute(
        select(Project)
        .options(selectinload(Project.budget))
        .where(Project.id == project_id)
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if project.user_id and project.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: You do not have permission to access another researcher's project",
        )

    return project


@router.patch("/{project_id}", response_model=ProjectRead)
async def update_project(
    project_id: str,
    payload: ProjectUpdate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> ProjectRead:
    result = await session.execute(
        select(Project)
        .options(selectinload(Project.budget))
        .where(Project.id == project_id)
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if project.user_id and project.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    elif not project.user_id:
        project.user_id = current_user.id

    if payload.name is not None and payload.name.strip():
        project.name = payload.name.strip()
    if payload.description is not None:
        project.description = payload.description.strip()
    if payload.objective is not None:
        project.objective = payload.objective.strip()
    if payload.status is not None:
        project.status = payload.status.strip()
    if payload.primary_model_profile_id is not None:
        project.primary_model_profile_id = payload.primary_model_profile_id
    if payload.critic_model_profile_id is not None:
        project.critic_model_profile_id = payload.critic_model_profile_id
    if payload.default_compute_target_id is not None:
        project.default_compute_target_id = payload.default_compute_target_id
    if payload.settings is not None:
        project.settings = payload.settings

    await session.commit()
    await session.refresh(project, attribute_names=["budget"])
    return project


@router.delete("/{project_id}", status_code=status.HTTP_200_OK)
async def delete_project(
    project_id: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> dict[str, str]:
    project = await session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if project.user_id and project.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    # Clean up associated budgets and runs safely
    await session.execute(delete(Budget).where(Budget.project_id == project_id))
    await session.execute(delete(Run).where(Run.project_id == project_id))
    await session.delete(project)
    await session.commit()
    return {"message": "Project deleted successfully", "id": project_id}

