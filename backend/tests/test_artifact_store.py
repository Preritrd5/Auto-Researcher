from pathlib import Path

import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.core.config import get_settings
from app.db.models import Base, Project, Run, StageRecord, new_id
from app.services.artifact_store import ArtifactStore


@pytest.mark.asyncio
async def test_artifact_store_writes_text_and_registers_artifact(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    monkeypatch.setenv("ARTIFACTS_ROOT", str(tmp_path))
    get_settings.cache_clear()

    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async_session = async_sessionmaker(engine, expire_on_commit=False)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session() as session:
        project_id = new_id()
        run_id = new_id()
        project = Project(id=project_id, name="Demo", slug="demo", description="", objective="")
        run = Run(id=run_id, project_id=project_id, name="Run", input_prompt="")
        stage = StageRecord(run_id=run_id, stage_key="brief_intake", stage_index=1)
        session.add_all([project, run, stage])
        await session.flush()

        store = ArtifactStore()
        artifact = await store.write_text(
            session,
            project_id=project.id,
            run_id=run.id,
            stage=stage,
            filename="brief.md",
            content="# brief",
            kind="brief",
        )
        await session.commit()

        assert artifact.relative_path == "brief_intake/brief.md"
        assert (tmp_path / project.id / run.id / "brief_intake" / "brief.md").exists()
