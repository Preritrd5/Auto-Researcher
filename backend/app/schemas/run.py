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


class EventRead(ORMModel):
    id: str
    run_id: str
    stage_id: str | None = None
    level: str = "info"
    event_type: str
    message: str
    payload: dict = Field(default_factory=dict)
    created_at: datetime


class CitationRead(ORMModel):
    id: str
    run_id: str
    stage_id: str | None = None
    source: str
    external_id: str = ""
    title: str
    authors: list[str] = Field(default_factory=list)
    year: int | None = None
    url: str = ""
    doi: str = ""
    venue: str = ""
    verified: bool = False
    created_at: datetime


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
    created_at: datetime | None = None
    updated_at: datetime | None = None
    stages: list[StageRead] = []

