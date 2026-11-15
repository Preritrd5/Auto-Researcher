from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user
from app.core.database import get_db_session
from app.db.models import Citation, Event, Project, Run, RunStatus, StageRecord, StageStatus, User
from app.schemas.common import APIMessage
from app.schemas.run import CitationRead, EventRead, RunCreate, RunRead

router = APIRouter(prefix="/runs", tags=["runs"])


@router.get("", response_model=list[RunRead])
async def list_runs(
    project_id: str | None = None,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> list[RunRead]:
    if project_id:
        proj_result = await session.execute(select(Project).where(Project.id == project_id))
        proj = proj_result.scalar_one_or_none()
        if not proj:
            raise HTTPException(status_code=404, detail="Project not found")
        if proj.user_id and proj.user_id != current_user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
        query = select(Run).options(selectinload(Run.stages)).where(Run.project_id == project_id).order_by(Run.created_at.desc())
    else:
        query = (
            select(Run)
            .join(Project, Run.project_id == Project.id)
            .options(selectinload(Run.stages))
            .where(Project.user_id == current_user.id)
            .order_by(Run.created_at.desc())
        )
    result = await session.execute(query)
    return list(result.scalars().unique())


@router.post("", response_model=RunRead)
async def create_run(
    payload: RunCreate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> RunRead:
    proj_result = await session.execute(select(Project).where(Project.id == payload.project_id))
    proj = proj_result.scalar_one_or_none()
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")

    if proj.user_id and proj.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied to this project")

    run = Run(
        project_id=payload.project_id,
        name=payload.name,
        input_prompt=payload.input_prompt,
        context=payload.context,
        status=RunStatus.queued.value,
    )
    session.add(run)
    await session.commit()
    await session.refresh(run, attribute_names=["stages"])
    return run


@router.get("/{run_id}", response_model=RunRead)
async def get_run(
    run_id: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> RunRead:
    result = await session.execute(
        select(Run).options(selectinload(Run.stages)).where(Run.id == run_id)
    )
    run = result.scalar_one_or_none()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    proj = await session.get(Project, run.project_id)
    if proj and proj.user_id and proj.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    return run


@router.get("/{run_id}/events", response_model=list[EventRead])
async def list_run_events(
    run_id: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> list[EventRead]:
    run = await session.get(Run, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    proj = await session.get(Project, run.project_id)
    if proj and proj.user_id and proj.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    result = await session.execute(
        select(Event)
        .where(Event.run_id == run_id, Event.event_type != "log")
        .order_by(Event.created_at.desc())
        .limit(50)
    )
    return list(result.scalars())


@router.get("/{run_id}/logs", response_model=list[EventRead])
async def list_run_logs(
    run_id: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> list[EventRead]:
    run = await session.get(Run, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    proj = await session.get(Project, run.project_id)
    if proj and proj.user_id and proj.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    result = await session.execute(
        select(Event)
        .where(Event.run_id == run_id, Event.event_type == "log")
        .order_by(Event.created_at.desc())
        .limit(100)
    )
    return list(result.scalars())


@router.get("/{run_id}/citations", response_model=list[CitationRead])
async def list_run_citations(
    run_id: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> list[CitationRead]:
    run = await session.get(Run, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    proj = await session.get(Project, run.project_id)
    if proj and proj.user_id and proj.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    result = await session.execute(
        select(Citation).where(Citation.run_id == run_id).order_by(Citation.created_at.asc())
    )
    return list(result.scalars())


@router.post("/{run_id}/stop", response_model=APIMessage)
async def stop_run(
    run_id: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> APIMessage:
    run = await session.get(Run, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    proj = await session.get(Project, run.project_id)
    if proj and proj.user_id and proj.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    run.status = RunStatus.stopped.value
    await session.commit()
    return APIMessage(message="Run stop requested")


@router.post("/{run_id}/retry", response_model=RunRead)
async def retry_run(
    run_id: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> RunRead:
    result = await session.execute(
        select(Run).options(selectinload(Run.stages)).where(Run.id == run_id)
    )
    run = result.scalar_one_or_none()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    proj = await session.get(Project, run.project_id)
    if proj and proj.user_id and proj.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    # Reset any failed stage back to pending
    for stage in run.stages:
        if stage.status in (StageStatus.failed.value, StageStatus.running.value):
            stage.status = StageStatus.pending.value
            stage.error_message = ""
            stage.failure_class = ""

    run.status = RunStatus.queued.value
    run.failure_class = None
    run.lease_owner = None
    run.leased_until = None
    run.retry_count += 1
    session.add(
        Event(
            run_id=run.id,
            event_type="run.retried",
            message=f"Operator requested retry #{run.retry_count}",
            payload={"retry_count": run.retry_count},
        )
    )
    await session.commit()
    await session.refresh(run, attribute_names=["stages"])
    return run

