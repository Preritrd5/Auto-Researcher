from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Memory, Project
from app.services.provider_gateway import ProviderGateway


class ChatService:
    def __init__(self, gateway: ProviderGateway) -> None:
        self.gateway = gateway

    async def reply(
        self,
        session: AsyncSession,
        *,
        project_id: str,
        message: str,
        model_profile_id: str | None = None,
    ) -> tuple[str, str, bool]:
        project = await session.get(Project, project_id)
        if not project:
            raise ValueError("Project not found")
        profile = await self.gateway.resolve_profile(
            session, model_profile_id or project.primary_model_profile_id
        )
        context_result = await session.execute(
            select(Memory).where(Memory.project_id == project_id).order_by(Memory.created_at.desc()).limit(5)
        )
        memories = list(context_result.scalars())
        context = "\n".join(f"- {memory.category}: {memory.content[:240]}" for memory in memories)
        if profile is None:
            degraded_reply = (
                f"Project '{project.name}' is running in template mode.\n\n"
                f"Objective: {project.objective or project.description or 'Not set'}\n"
                f"Recent memory:\n{context or '- no memory recorded yet'}\n\n"
                f"Operator note: {message}"
            )
            return degraded_reply, "template-fallback", True

        result = await self.gateway.chat(
            profile,
            [
                {
                    "role": "system",
                    "content": (
                        "You are Auto-Researcher, a durable ML/AI research copilot. "
                        "Answer concisely, grounded in project state, and avoid fabricating citations."
                    ),
                },
                {
                    "role": "user",
                    "content": (
                        f"Project: {project.name}\n"
                        f"Objective: {project.objective or project.description}\n"
                        f"Recent memory:\n{context or '- none'}\n\n"
                        f"User message: {message}"
                    ),
                },
            ],
        )
        return result.text, result.model_name, result.degraded

