from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db_session
from app.db.models import Memory, Project, User
from app.schemas.chat import ChatMessageRead, ChatRequest, ChatResponse
from app.services.chat_service import ChatService
from app.services.provider_gateway import ProviderGateway

router = APIRouter(prefix="/chat", tags=["chat"])
chat_service = ChatService(ProviderGateway())


@router.get("", response_model=list[ChatMessageRead])
async def list_chat_messages(
    project_id: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> list[ChatMessageRead]:
    project = await session.get(Project, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if project.user_id and project.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    result = await session.execute(
        select(Memory)
        .where(Memory.project_id == project_id, Memory.category == "chat_message")
        .order_by(Memory.created_at.asc())
    )
    memories = list(result.scalars())
    return [
        ChatMessageRead(
            id=m.id,
            role=str(m.memory_metadata.get("role", "assistant")),
            content=m.content,
            model_name=m.memory_metadata.get("model_name"),
            degraded=bool(m.memory_metadata.get("degraded", False)),
            created_at=m.created_at,
        )
        for m in memories
    ]


@router.post("", response_model=ChatResponse)
async def chat(
    payload: ChatRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> ChatResponse:
    project = await session.get(Project, payload.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if project.user_id and project.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    # Save user message to persistent conversation history
    session.add(
        Memory(
            project_id=project.id,
            run_id=payload.run_id,
            category="chat_message",
            content=payload.message,
            memory_metadata={"role": "user"},
        )
    )

    reply, model_name, degraded = await chat_service.reply(
        session,
        project_id=payload.project_id,
        message=payload.message,
        model_profile_id=payload.model_profile_id,
    )

    # Save assistant reply to persistent conversation history
    session.add(
        Memory(
            project_id=project.id,
            run_id=payload.run_id,
            category="chat_message",
            content=reply,
            memory_metadata={"role": "assistant", "model_name": model_name, "degraded": degraded},
        )
    )
    await session.commit()

    return ChatResponse(reply=reply, model_name=model_name, degraded=degraded)

