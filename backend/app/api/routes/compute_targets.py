from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db_session
from app.db.models import ComputeTarget
from app.schemas.compute import ComputeTargetCreate, ComputeTargetRead

router = APIRouter(prefix="/compute-targets", tags=["compute-targets"])


@router.get("", response_model=list[ComputeTargetRead])
async def list_compute_targets(session: AsyncSession = Depends(get_db_session)) -> list[ComputeTargetRead]:
    result = await session.execute(select(ComputeTarget).order_by(ComputeTarget.priority.asc()))
    return list(result.scalars())


@router.post("", response_model=ComputeTargetRead)
async def create_compute_target(
    payload: ComputeTargetCreate,
    session: AsyncSession = Depends(get_db_session),
) -> ComputeTargetRead:
    target = ComputeTarget(**payload.model_dump())
    session.add(target)
    await session.commit()
    await session.refresh(target)
    return target

