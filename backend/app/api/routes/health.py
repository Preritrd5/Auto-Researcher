from __future__ import annotations

from datetime import datetime, timezone
import logging
from fastapi import APIRouter, Depends, Response, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.database import get_db_session

logger = logging.getLogger("auto_researcher.health")
router = APIRouter(tags=["health"])
settings = get_settings()


@router.get("/health")
async def health_check(
    response: Response,
    session: AsyncSession = Depends(get_db_session),
) -> dict:
    db_ok = False
    try:
        await session.execute(text("SELECT 1"))
        db_ok = True
    except Exception as exc:
        logger.error("Health check DB probe failed: %s", exc)
        db_ok = False

    is_healthy = db_ok
    if not is_healthy:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE

    return {
        "status": "healthy" if is_healthy else "degraded",
        "database": "connected" if db_ok else "disconnected",
        "environment": settings.environment,
        "version": "0.1.0",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/health/live")
async def liveness_probe() -> dict:
    """Kubernetes / container liveness probe (checks if process is running)."""
    return {"status": "alive", "timestamp": datetime.now(timezone.utc).isoformat()}


@router.get("/health/ready")
async def readiness_probe(
    response: Response,
    session: AsyncSession = Depends(get_db_session),
) -> dict:
    """Kubernetes / container readiness probe (checks if service is ready to accept traffic)."""
    try:
        await session.execute(text("SELECT 1"))
        return {"status": "ready", "database": "connected"}
    except Exception as exc:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return {"status": "not_ready", "error": str(exc)}

