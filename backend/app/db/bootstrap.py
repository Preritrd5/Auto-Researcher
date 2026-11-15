from __future__ import annotations

from uuid import uuid4

from slugify import slugify
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import engine
from app.db.models import Base, ComputeTarget


async def create_all_tables() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

        def _ensure_project_user_id(sync_conn) -> None:
            from sqlalchemy import inspect, text
            inspector = inspect(sync_conn)
            if "projects" in inspector.get_table_names():
                cols = [c["name"] for c in inspector.get_columns("projects")]
                if "user_id" not in cols:
                    sync_conn.execute(text("ALTER TABLE projects ADD COLUMN user_id VARCHAR(36) REFERENCES users(id)"))

        await conn.run_sync(_ensure_project_user_id)


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
    base = slugify(name) or "project"
    return f"{base}-{uuid4().hex[:6]}"

