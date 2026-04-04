from __future__ import annotations

from pydantic import BaseModel


class ChatRequest(BaseModel):
    project_id: str
    message: str
    run_id: str | None = None
    model_profile_id: str | None = None


class ChatResponse(BaseModel):
    reply: str
    model_name: str
    degraded: bool = False

