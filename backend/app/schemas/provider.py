from __future__ import annotations

from pydantic import BaseModel, Field

from app.schemas.common import ORMModel


class ModelProfileCreate(BaseModel):
    name: str
    provider_kind: str
    model_name: str
    base_url: str = ""
    api_key_env: str = ""
    cli_command: str = ""
    capabilities: dict = Field(default_factory=dict)
    profile_metadata: dict = Field(default_factory=dict)
    active: bool = True


class ModelProfileRead(ORMModel):
    id: str
    name: str
    provider_kind: str
    model_name: str
    base_url: str
    api_key_env: str
    cli_command: str
    capabilities: dict
    profile_metadata: dict
    active: bool


class ProviderTestRequest(BaseModel):
    profile_id: str | None = None
    profile: ModelProfileCreate | None = None
    prompt: str = "ping"


class ProviderTestResponse(BaseModel):
    ok: bool
    message: str
    latency_ms: int | None = None
    sample: str = ""
