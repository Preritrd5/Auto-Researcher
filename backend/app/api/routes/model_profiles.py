from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db_session
from app.db.models import ModelProfile
from app.schemas.provider import ModelProfileCreate, ModelProfileRead

router = APIRouter(prefix="/model-profiles", tags=["model-profiles"])


@router.get("", response_model=list[ModelProfileRead])
async def list_model_profiles(session: AsyncSession = Depends(get_db_session)) -> list[ModelProfileRead]:
    result = await session.execute(select(ModelProfile).order_by(ModelProfile.created_at.desc()))
    return list(result.scalars())


@router.post("", response_model=ModelProfileRead)
async def create_model_profile(
    payload: ModelProfileCreate,
    session: AsyncSession = Depends(get_db_session),
) -> ModelProfileRead:
    profile = ModelProfile(**payload.model_dump())
    session.add(profile)
    await session.commit()
    await session.refresh(profile)
    return profile


@router.get("/{profile_id}", response_model=ModelProfileRead)
async def get_model_profile(
    profile_id: str,
    session: AsyncSession = Depends(get_db_session),
) -> ModelProfileRead:
    profile = await session.get(ModelProfile, profile_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Model profile not found")
    return profile

