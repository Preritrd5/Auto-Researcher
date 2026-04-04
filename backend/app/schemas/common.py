from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class APIMessage(BaseModel):
    message: str


class EventPayload(BaseModel):
    event_type: str
    message: str
    payload: dict[str, Any] = {}
    created_at: datetime | None = None

