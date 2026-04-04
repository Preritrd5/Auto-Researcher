from __future__ import annotations

from datetime import timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db_session
from app.db.models import Run, RunStatus
from app.schemas.common import APIMessage
from app.schemas.run import RunCreate, RunRead

router = APIRouter(prefix="/runs", tags=["runs"])


@router.get("", response_model=list[RunRead])
async def list_runs(project_id: str | None = None, session: AsyncSession = Depends(get_db_session)) -> list[RunRead]:
    query = select(Run).options(selectinload(Run.stages)).order_by(Run.created_at.desc())
    if project_id:
        query = query.where(Run.project_id == project_id)
    result = await session.execute(query)
    return list(result.scalars().unique())


@router.post("", response_model=RunRead)
async def create_run(payload: RunCreate, session: AsyncSession = Depends(get_db_session)) -> RunRead:
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
async def get_run(run_id: str, session: AsyncSession = Depends(get_db_session)) -> RunRead:
    result = await session.execute(
        select(Run).options(selectinload(Run.stages)).where(Run.id == run_id)
    )
    run = result.scalar_one_or_none()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    return run


@router.post("/{run_id}/stop", response_model=APIMessage)
async def stop_run(run_id: str, session: AsyncSession = Depends(get_db_session)) -> APIMessage:
    run = await session.get(Run, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    run.status = RunStatus.stopped.value
    await session.commit()
    return APIMessage(message="Run stop requested")

