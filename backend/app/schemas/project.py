from __future__ import annotations

from datetime import datetime
from pydantic import BaseModel, Field

from app.schemas.common import ORMModel


class BudgetCreate(BaseModel):
    max_cost_usd: float = 50.0
    max_runtime_minutes: int = 360
    max_tokens: int = 2_000_000


class ProjectCreate(BaseModel):
    name: str
    description: str = ""
    objective: str = ""
    primary_model_profile_id: str | None = None
    critic_model_profile_id: str | None = None
    default_compute_target_id: str | None = None
    settings: dict = Field(default_factory=dict)
    budget: BudgetCreate = Field(default_factory=BudgetCreate)


class ProjectUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    objective: str | None = None
    status: str | None = None
    primary_model_profile_id: str | None = None
    critic_model_profile_id: str | None = None
    default_compute_target_id: str | None = None
    settings: dict | None = None


class BudgetRead(ORMModel):
    id: str
    max_cost_usd: float
    max_runtime_minutes: int
    max_tokens: int
    spent_cost_usd: float
    spent_tokens: int


class ProjectRead(ORMModel):
    id: str
    user_id: str | None = None
    name: str
    slug: str
    description: str
    objective: str
    status: str
    primary_model_profile_id: str | None = None
    critic_model_profile_id: str | None = None
    default_compute_target_id: str | None = None
    settings: dict
    budget: BudgetRead | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None
