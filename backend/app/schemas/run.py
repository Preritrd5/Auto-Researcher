from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.common import ORMModel


class RunCreate(BaseModel):
    project_id: str
    name: str
    input_prompt: str = ""
    context: dict = Field(default_factory=dict)


class StageRead(ORMModel):
    id: str
    stage_key: str
    stage_index: int
    status: str
    attempt_count: int
    error_message: str
    failure_class: str
    started_at: datetime | None = None
    completed_at: datetime | None = None
    output_snapshot: dict


class RunRead(ORMModel):
    id: str
    project_id: str
    name: str
    status: str
    current_stage_key: str | None = None
    stage_cursor: int
    input_prompt: str
    context: dict
    retry_count: int
    total_cost_usd: float
    total_tokens: int
    failure_class: str | None = None
    started_at: datetime | None = None
    completed_at: datetime | None = None
    stages: list[StageRead] = []

