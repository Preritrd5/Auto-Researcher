from pathlib import Path

import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.core.config import get_settings
from app.db.models import Base, Project, Run, StageRecord, new_id
from app.orchestrator.stages import StageExecutor
from app.retrieval.citation_verifier import CitationVerifier
from app.retrieval.literature_search import LiteratureSearchService
from app.services.artifact_store import ArtifactStore
from app.services.event_bus import EventBus
from app.services.provider_gateway import ProviderGateway


@pytest.mark.asyncio
async def test_stage_executor_runs_local_experiment(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    monkeypatch.setenv("ARTIFACTS_ROOT", str(tmp_path))
    monkeypatch.setenv("REDIS_URL", "redis://localhost:6399/0")
    get_settings.cache_clear()

    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async_session = async_sessionmaker(engine, expire_on_commit=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session() as session:
        project_id = new_id()
        run_id = new_id()
        project = Project(id=project_id, name="Demo", slug="demo", description="desc", objective="obj")
        run = Run(id=run_id, project_id=project_id, name="Run", input_prompt="prompt")
        planning = StageRecord(run_id=run_id, stage_key="experiment_planning", stage_index=6)
        codegen = StageRecord(run_id=run_id, stage_key="code_generation", stage_index=7)
        experiment = StageRecord(run_id=run_id, stage_key="experiment_run_refine_loop", stage_index=8)
        session.add_all([project, run, planning, codegen, experiment])
        await session.flush()

        store = ArtifactStore()
        await store.write_yaml(
            session,
            project_id=project.id,
            run_id=run.id,
            stage=planning,
            filename="experiment_plan.yaml",
            data={"command_template": "python experiment.py --steps 10 --seed 7"},
            kind="experiment_plan",
        )
        await store.write_text(
            session,
            project_id=project.id,
            run_id=run.id,
            stage=codegen,
            filename="workspace_snapshot/experiment.py",
            content=(
                "import json\n"
                "print('AUTO_RESEARCH_METRICS=' + json.dumps({'accuracy': 0.81, 'loss': 0.19}))\n"
            ),
            kind="workspace_file",
        )
        await session.commit()

        executor = StageExecutor(
            artifact_store=store,
            event_bus=EventBus(),
            provider_gateway=ProviderGateway(),
            literature_search=LiteratureSearchService(),
            citation_verifier=CitationVerifier(LiteratureSearchService()),
        )
        result = await executor._stage_experiment_run_refine_loop(session, project, run, experiment)
        assert result["success"] is True
        assert result["metrics"]["accuracy"] == 0.81
