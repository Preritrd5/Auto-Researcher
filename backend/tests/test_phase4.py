from __future__ import annotations

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.core.database import get_db_session
from app.db.models import Base, Project, Run, RunStatus, StageRecord, StageStatus, User, new_id
from app.main import app


@pytest.mark.asyncio
async def test_phase4_chat_and_run_endpoints() -> None:
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async_session = async_sessionmaker(engine, expire_on_commit=False)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async def override_get_db_session():
        async with async_session() as session:
            yield session

    app.dependency_overrides[get_db_session] = override_get_db_session

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Register user
        reg = await client.post(
            "/api/auth/register",
            json={
                "name": "Dr. Richard Feynman",
                "email": "feynman@caltech.edu",
                "password": "QEDQuantum1965!",
                "confirm_password": "QEDQuantum1965!",
            },
        )
        assert reg.status_code == 201
        token = reg.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # Create project
        proj = await client.post(
            "/api/projects",
            json={
                "name": "Quantum Electrodynamics Exploration",
                "objective": "Formulate path integral formulation for non-relativistic particles",
                "description": "Fundamental physics research.",
            },
            headers=headers,
        )
        assert proj.status_code == 200
        proj_id = proj.json()["id"]

        # 1. Chat workflow
        chat_req = await client.post(
            "/api/chat",
            json={"project_id": proj_id, "message": "What is our primary research objective?"},
            headers=headers,
        )
        assert chat_req.status_code == 200
        chat_data = chat_req.json()
        assert "reply" in chat_data
        assert chat_data["degraded"] is True or chat_data["model_name"]

        # Retrieve chat history
        chat_hist = await client.get(f"/api/chat?project_id={proj_id}", headers=headers)
        assert chat_hist.status_code == 200
        messages = chat_hist.json()
        assert len(messages) == 2  # 1 user + 1 assistant
        assert messages[0]["role"] == "user"
        assert messages[0]["content"] == "What is our primary research objective?"
        assert messages[1]["role"] == "assistant"

        # 2. Run workflow
        run_res = await client.post(
            "/api/runs",
            json={
                "project_id": proj_id,
                "name": "Initial Formulation Run",
                "input_prompt": "Perform literature scan on path integrals",
            },
            headers=headers,
        )
        assert run_res.status_code == 200
        run_id = run_res.json()["id"]

        # Events endpoint
        events_res = await client.get(f"/api/runs/{run_id}/events", headers=headers)
        assert events_res.status_code == 200
        assert isinstance(events_res.json(), list)

        # Logs endpoint
        logs_res = await client.get(f"/api/runs/{run_id}/logs", headers=headers)
        assert logs_res.status_code == 200
        assert isinstance(logs_res.json(), list)

        # Citations endpoint
        citations_res = await client.get(f"/api/runs/{run_id}/citations", headers=headers)
        assert citations_res.status_code == 200
        assert isinstance(citations_res.json(), list)

        # Retry endpoint
        retry_res = await client.post(f"/api/runs/{run_id}/retry", headers=headers)
        assert retry_res.status_code == 200
        assert retry_res.json()["status"] == "queued"

    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_worker_executes_full_run(monkeypatch: pytest.MonkeyPatch, tmp_path) -> None:
    from app.core.config import get_settings
    from app.orchestrator.worker import ResearchWorker
    from app.db.models import Artifact
    from app.retrieval.literature_search import PaperCandidate

    db_path = tmp_path / "test_research.db"
    artifacts_dir = tmp_path / "artifacts"
    artifacts_dir.mkdir(parents=True, exist_ok=True)

    monkeypatch.setenv("ARTIFACTS_ROOT", str(artifacts_dir))
    monkeypatch.setenv("REDIS_URL", "redis://localhost:6399/0")
    monkeypatch.setenv("DATABASE_URL", f"sqlite+aiosqlite:///{db_path}")
    get_settings.cache_clear()

    engine = create_async_engine(f"sqlite+aiosqlite:///{db_path}")
    async_session = async_sessionmaker(engine, expire_on_commit=False)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Insert test project and run
    project_id = new_id()
    run_id = new_id()
    async with async_session() as session:
        proj = Project(
            id=project_id,
            name="End-to-End Quantum Optimization",
            slug="end-to-end-quantum-opt",
            objective="Develop quantum annealing simulation for traveling salesperson",
            description="Autonomous optimization test",
        )
        run = Run(
            id=run_id,
            project_id=project_id,
            name="Autonomous Execution Loop",
            input_prompt="Optimize Hamiltonian penalty factors",
            status=RunStatus.queued.value,
        )
        session.add_all([proj, run])
        await session.commit()

    # Monkeypatch session_scope in worker to use our test engine
    from contextlib import asynccontextmanager

    @asynccontextmanager
    async def override_session_scope():
        async with async_session() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise

    monkeypatch.setattr("app.orchestrator.worker.session_scope", override_session_scope)

    # Mock literature search to return grounded paper candidate quickly
    async def mock_search(query: str, limit: int = 5):
        return [
            PaperCandidate(
                source="arxiv",
                external_id="2103.00020",
                title="Learning Transferable Visual Models From Natural Language Supervision",
                authors=["Alec Radford", "Jong Wook Kim"],
                year=2021,
                url="https://arxiv.org/abs/2103.00020",
                venue="ICML",
            )
        ]

    worker = ResearchWorker(worker_id="test-e2e-worker")
    monkeypatch.setattr(worker.literature_search, "search", mock_search)

    # Step through all 10 stages
    for step in range(20):
        processed = await worker.process_next_run()
        if not processed:
            break

    # Verify run completed
    async with async_session() as session:
        completed_run = await session.get(Run, run_id)
        assert completed_run is not None
        assert completed_run.status == RunStatus.completed.value
        assert completed_run.completed_at is not None

        # Verify artifacts were generated
        result = await session.execute(
            select(Artifact).where(Artifact.run_id == run_id)
        )
        artifacts = list(result.scalars())
        artifact_paths = [a.relative_path for a in artifacts]
        
        # Check critical artifacts across the research pipeline
        assert any("brief.md" in p for p in artifact_paths), "Missing brief.md"
        assert any("literature_report.md" in p for p in artifact_paths), "Missing literature_report.md"
        assert any("idea_board.json" in p for p in artifact_paths), "Missing idea_board.json"
        assert any("proposal.md" in p for p in artifact_paths), "Missing proposal.md"
        assert any("experiment_plan.yaml" in p for p in artifact_paths), "Missing experiment_plan.yaml"
        assert any("experiment.py" in p for p in artifact_paths), "Missing experiment.py"
        assert any("run_metrics.json" in p for p in artifact_paths), "Missing run_metrics.json"
        assert any("analysis_report.md" in p for p in artifact_paths), "Missing analysis_report.md"
        assert any("claim_decision.json" in p for p in artifact_paths), "Missing claim_decision.json"
        assert any("paper.md" in p for p in artifact_paths), "Missing paper.md"


