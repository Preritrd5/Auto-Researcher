from __future__ import annotations

from slugify import slugify
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import engine
from app.db.models import Base, ComputeTarget


async def create_all_tables() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def bootstrap_defaults(session: AsyncSession) -> None:
    result = await session.execute(select(ComputeTarget).where(ComputeTarget.name == "local-default"))
    existing = result.scalar_one_or_none()
    if existing is None:
        session.add(
            ComputeTarget(
                name="local-default",
                kind="local",
                priority=1,
                config={"workdir": ".", "python_bin": "python3"},
            )
        )
        await session.commit()


def unique_slug(name: str) -> str:
    return slugify(name) or "project"

