from __future__ import annotations

from datetime import datetime
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


class ChatMessageRead(BaseModel):
    id: str
    role: str  # "user" | "assistant"
    content: str
    model_name: str | None = None
    degraded: bool = False
    created_at: datetime


