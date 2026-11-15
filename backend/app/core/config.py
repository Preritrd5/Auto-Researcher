from __future__ import annotations

import json
import logging
import re
import sys
from functools import lru_cache
from pathlib import Path
from typing import Any

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger("auto_researcher.config")


def _normalize_windows_path(path_str: str) -> str:
    if sys.platform == "win32":
        match = re.match(r"^/+([a-zA-Z])/(.*)$", path_str)
        if match:
            drive, rest = match.groups()
            return f"{drive.upper()}:/{rest}"
    return path_str


def _normalize_database_url(url: str, base_dir: Path) -> str:
    if "sqlite" not in url:
        return url
    prefix = url.split(":///", 1)[0] + ":///"
    raw_path = url[len(prefix):]
    norm_path = _normalize_windows_path(raw_path)
    p = Path(norm_path)
    if not p.is_absolute() and not (sys.platform == "win32" and re.match(r"^[a-zA-Z]:", norm_path)):
        norm_path = (base_dir / norm_path).resolve().as_posix()
    return f"{prefix}{norm_path}"


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
    cors_origins: list[str] = Field(
        default=["http://localhost:3000", "http://127.0.0.1:3000"],
        alias="CORS_ORIGINS",
    )
    db_pool_size: int = Field(default=10, alias="DB_POOL_SIZE")
    db_max_overflow: int = Field(default=20, alias="DB_MAX_OVERFLOW")
    db_pool_recycle: int = Field(default=300, alias="DB_POOL_RECYCLE")
    lease_seconds: int = 90
    worker_poll_seconds: int = 3
    max_stage_retries: int = 3

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, v: Any) -> list[str]:
        if isinstance(v, str):
            clean = v.strip()
            if clean.startswith("[") and clean.endswith("]"):
                try:
                    parsed = json.loads(clean)
                    if isinstance(parsed, list):
                        return [str(origin).strip() for origin in parsed if str(origin).strip()]
                except Exception:
                    pass
            return [origin.strip() for origin in clean.split(",") if origin.strip()]
        if isinstance(v, list):
            return [str(origin).strip() for origin in v if str(origin).strip()]
        return ["http://localhost:3000", "http://127.0.0.1:3000"]

    model_config = SettingsConfigDict(
        env_file="../.env",
        env_file_encoding="utf-8",
        extra="ignore",
        populate_by_name=True,
    )


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    backend_dir = Path(__file__).resolve().parents[2]
    settings.database_url = _normalize_database_url(settings.database_url, backend_dir)
    artifacts_str = _normalize_windows_path(str(settings.artifacts_root))
    settings.artifacts_root = (
        (backend_dir / artifacts_str).resolve()
        if not Path(artifacts_str).is_absolute() and not (sys.platform == "win32" and re.match(r"^[a-zA-Z]:", artifacts_str))
        else Path(artifacts_str)
    )
    settings.artifacts_root.mkdir(parents=True, exist_ok=True)
    if settings.environment.lower() == "production" and settings.secret == "please-change-this-secret":
        logger.warning(
            "CRITICAL SECURITY WARNING: AUTO_RESEARCHER_SECRET is using the insecure default value in production! "
            "Set a cryptographically strong 64-character secret in your production environment variables."
        )
    return settings
