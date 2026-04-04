from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db_session
from app.db.models import ModelProfile
from app.schemas.provider import ProviderTestRequest, ProviderTestResponse
from app.services.provider_gateway import ProviderGateway

router = APIRouter(prefix="/providers", tags=["providers"])
gateway = ProviderGateway()


@router.post("/test", response_model=ProviderTestResponse)
async def test_provider(
    payload: ProviderTestRequest,
    session: AsyncSession = Depends(get_db_session),
) -> ProviderTestResponse:
    profile: ModelProfile | None = None
    if payload.profile_id:
        profile = await session.get(ModelProfile, payload.profile_id)
    elif payload.profile:
        profile = ModelProfile(**payload.profile.model_dump())
    if profile is None:
        raise HTTPException(status_code=400, detail="Provide profile_id or inline profile")
    ok, message, latency_ms, sample = await gateway.test_profile(profile, prompt=payload.prompt)
    return ProviderTestResponse(ok=ok, message=message, latency_ms=latency_ms, sample=sample)

