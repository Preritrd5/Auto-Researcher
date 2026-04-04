from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Auto-Researcher"
    environment: str = Field(default="development", alias="AUTO_RESEARCHER_ENV")
    secret: str = Field(default="please-change-this-secret", alias="AUTO_RESEARCHER_SECRET")
    database_url: str = Field(
        default="sqlite+aiosqlite:///./auto_researcher.db",
        alias="DATABASE_URL",
    )
    redis_url: str = Field(default="redis://localhost:6379/0", alias="REDIS_URL")
    artifacts_root: Path = Field(default=Path("../artifacts"), alias="ARTIFACTS_ROOT")
    log_level: str = Field(default="INFO", alias="LOG_LEVEL")
    semantic_scholar_api_key: str = Field(default="", alias="SEMANTIC_SCHOLAR_API_KEY")
    cors_origins: list[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]
    lease_seconds: int = 90
    worker_poll_seconds: int = 3
    max_stage_retries: int = 3

    model_config = SettingsConfigDict(
        env_file="../.env",
        env_file_encoding="utf-8",
        extra="ignore",
        populate_by_name=True,
    )


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    settings.artifacts_root.mkdir(parents=True, exist_ok=True)
    return settings
