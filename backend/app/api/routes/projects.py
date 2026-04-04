from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db_session
from app.db.bootstrap import unique_slug
from app.db.models import Budget, Project
from app.schemas.project import ProjectCreate, ProjectRead

router = APIRouter(prefix="/projects", tags=["projects"])


@router.get("", response_model=list[ProjectRead])
async def list_projects(session: AsyncSession = Depends(get_db_session)) -> list[ProjectRead]:
    result = await session.execute(
        select(Project).options(selectinload(Project.budget)).order_by(Project.created_at.desc())
    )
    return list(result.scalars().unique())


@router.post("", response_model=ProjectRead)
async def create_project(payload: ProjectCreate, session: AsyncSession = Depends(get_db_session)) -> ProjectRead:
    project = Project(
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
async def get_project(project_id: str, session: AsyncSession = Depends(get_db_session)) -> ProjectRead:
    result = await session.execute(
        select(Project)
        .options(selectinload(Project.budget))
        .where(Project.id == project_id)
    )
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project
