from __future__ import annotations

import sys
from pathlib import Path
import pytest

# Ensure scripts dir is accessible
scripts_dir = Path(__file__).resolve().parents[2] / "scripts"
if str(scripts_dir) not in sys.path:
    sys.path.insert(0, str(scripts_dir))

from migrate_sqlite_to_postgres import migrate_data
from app.db.models import Base, User, Project
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession


@pytest.mark.asyncio
async def test_migration_pipeline(tmp_path):
    src_db = tmp_path / "src.db"
    dst_db = tmp_path / "dst.db"

    src_url = f"sqlite+aiosqlite:///{src_db.as_posix()}"
    dst_url = f"sqlite+aiosqlite:///{dst_db.as_posix()}"

    # Setup source DB with sample data
    src_engine = create_async_engine(src_url)
    async with src_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    SrcSession = async_sessionmaker(src_engine, expire_on_commit=False, class_=AsyncSession)
    async with SrcSession() as session:
        user = User(
            id="u1",
            name="Migration Test User",
            email="migrate@example.com",
            hashed_password="hashed_secret",
            role="lead_researcher",
        )
        session.add(user)
        proj = Project(
            id="p1",
            user_id="u1",
            name="Migrated Project",
            slug="migrated-project",
            description="Testing DB migration",
        )
        session.add(proj)
        await session.commit()
    await src_engine.dispose()

    # Run migration
    results = await migrate_data(src_url, dst_url, dry_run=False)

    assert results["users"]["migrated"] == 1
    assert results["projects"]["migrated"] == 1

    # Verify target DB has the data
    dst_engine = create_async_engine(dst_url)
    DstSession = async_sessionmaker(dst_engine, expire_on_commit=False, class_=AsyncSession)
    async with DstSession() as session:
        dst_user = await session.get(User, "u1")
        assert dst_user is not None
        assert dst_user.email == "migrate@example.com"
        assert dst_user.name == "Migration Test User"

        dst_proj = await session.get(Project, "p1")
        assert dst_proj is not None
        assert dst_proj.name == "Migrated Project"
        assert dst_proj.user_id == "u1"
    await dst_engine.dispose()
