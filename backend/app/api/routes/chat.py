from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db_session
from app.schemas.chat import ChatRequest, ChatResponse
from app.services.chat_service import ChatService
from app.services.provider_gateway import ProviderGateway

router = APIRouter(prefix="/chat", tags=["chat"])
chat_service = ChatService(ProviderGateway())


@router.post("", response_model=ChatResponse)
async def chat(payload: ChatRequest, session: AsyncSession = Depends(get_db_session)) -> ChatResponse:
    reply, model_name, degraded = await chat_service.reply(
        session,
        project_id=payload.project_id,
        message=payload.message,
        model_profile_id=payload.model_profile_id,
    )
    return ChatResponse(reply=reply, model_name=model_name, degraded=degraded)

