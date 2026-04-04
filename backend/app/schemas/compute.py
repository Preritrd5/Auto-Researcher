from __future__ import annotations

from pydantic import BaseModel, Field

from app.schemas.common import ORMModel


class ComputeTargetCreate(BaseModel):
    name: str
    kind: str
    priority: int = 100
    active: bool = True
    config: dict = Field(default_factory=dict)


class ComputeTargetRead(ORMModel):
    id: str
    name: str
    kind: str
    priority: int
    active: bool
    config: dict

