from __future__ import annotations

import asyncio
import logging
from datetime import timedelta
from datetime import timezone

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.config import get_settings
from app.core.database import session_scope
from app.db.models import Event, Project, Run, RunStatus, StageRecord, StageStatus, Task, utcnow
from app.orchestrator.contracts import STAGES
from app.orchestrator.recovery import RecoveryManager
from app.orchestrator.stages import StageExecutor
from app.retrieval.citation_verifier import CitationVerifier
from app.retrieval.literature_search import LiteratureSearchService
from app.services.artifact_store import ArtifactStore
from app.services.event_bus import EventBus
from app.services.provider_gateway import ProviderGateway

logger = logging.getLogger("auto_researcher.worker")
if not logger.handlers:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")


class ResearchWorker:
    def __init__(self, worker_id: str) -> None:
        self.worker_id = worker_id
        self.settings = get_settings()
        self.event_bus = EventBus()
        self.artifact_store = ArtifactStore()
        self.provider_gateway = ProviderGateway()
        self.literature_search = LiteratureSearchService()
        self.citation_verifier = CitationVerifier(self.literature_search)
        self.recovery = RecoveryManager()
        self.stage_executor = StageExecutor(
            artifact_store=self.artifact_store,
            event_bus=self.event_bus,
            provider_gateway=self.provider_gateway,
            literature_search=self.literature_search,
            citation_verifier=self.citation_verifier,
        )

    async def run_forever(self) -> None:
        while True:
            processed = await self.process_next_run()
            if not processed:
                await asyncio.sleep(self.settings.worker_poll_seconds)

    async def process_next_run(self) -> bool:
        async with session_scope() as session:
            run = await self._acquire_next_run(session)
            if run is None:
                return False
            project = await session.get(Project, run.project_id)
            assert project is not None
            await self._ensure_stage_records(session, run)
            stage = self._next_stage(run)
            run_id = run.id
            project_id = run.project_id
            if stage is None:
                run.status = RunStatus.completed.value
                run.completed_at = utcnow()
                logger.info("[Worker %s] Run %s completed successfully.", self.worker_id, run.id)
                await self._record_event(session, run.id, None, "run.completed", "Run completed")
                await self._record_event(session, run.id, None, "log", "Run completed successfully across all stages.")
                await session.flush()
                await self.event_bus.publish_event(
                    run.id,
                    {"event_type": "run.completed", "message": "Run completed", "payload": {"run_id": run.id}},
                )
                return True
            stage_key = stage.stage_key
            stage_id = stage.id
            run.status = RunStatus.running.value
            run.current_stage_key = stage.stage_key
            run.started_at = run.started_at or utcnow()
            run.heartbeat_at = utcnow()
            run.leased_until = utcnow() + timedelta(seconds=self.settings.lease_seconds)
            stage.status = StageStatus.running.value
            stage.attempt_count += 1
            stage.started_at = stage.started_at or utcnow()
            task = Task(
                run_id=run.id,
                stage_id=stage.id,
                role=stage.stage_key,
                status=StageStatus.running.value,
                attempt_count=stage.attempt_count,
                input_text=run.input_prompt,
            )
            session.add(task)
            logger.info("[Worker %s] Run %s | Stage [%d/10: %s] started.", self.worker_id, run.id, stage.stage_index, stage.stage_key)
            await self._record_event(
                session,
                run.id,
                stage.id,
                "stage.started",
                f"Stage {stage.stage_key} started",
                {"attempt": stage.attempt_count},
            )
            await self._record_event(
                session,
                run.id,
                stage.id,
                "log",
                f"[{stage.stage_key}] Started stage execution (attempt #{stage.attempt_count}).",
                {"stage_key": stage.stage_key, "attempt": stage.attempt_count},
            )
            await session.flush()
            await self.event_bus.publish_event(
                run.id,
                {
                    "event_type": "stage.started",
                    "message": f"Stage {stage.stage_key} started",
                    "payload": {"stage_key": stage.stage_key, "attempt": stage.attempt_count},
                },
            )

        try:
            async with session_scope() as session:
                run = await session.get(Run, run_id, options=[selectinload(Run.stages)])
                project = await session.get(Project, project_id)
                stage = self._find_stage(run, stage_key)
                assert run is not None and project is not None and stage is not None
                result = await self.stage_executor.execute(session, project, run, stage)
                stage.status = StageStatus.completed.value
                stage.completed_at = utcnow()
                stage.output_snapshot = result
                run.stage_cursor = stage.stage_index
                run.failure_class = None
                task = await self._latest_task(session, run.id, stage.id)
                if task:
                    task.status = StageStatus.completed.value
                    task.output_text = str(result)
                    task.completed_at = utcnow()
                logger.info("[Worker %s] Run %s | Stage [%s] completed successfully.", self.worker_id, run.id, stage.stage_key)
                await self._record_event(
                    session,
                    run.id,
                    stage.id,
                    "stage.completed",
                    f"Stage {stage.stage_key} completed",
                    result,
                )
                await self._record_event(
                    session,
                    run.id,
                    stage.id,
                    "log",
                    f"[{stage.stage_key}] Stage completed successfully.",
                    {"stage_key": stage.stage_key, "result": result},
                )
                await session.flush()
                await self.event_bus.publish_event(
                    run.id,
                    {
                        "event_type": "stage.completed",
                        "message": f"Stage {stage.stage_key} completed",
                        "payload": {"stage_key": stage.stage_key, "result": result},
                    },
                )
                await self.event_bus.publish_log(
                    run.id,
                    {
                        "event_type": "log",
                        "message": f"{stage.stage_key}: completed",
                        "payload": {"result": result},
                    },
                )
                return True
        except Exception as exc:
            async with session_scope() as session:
                run = await session.get(Run, run_id, options=[selectinload(Run.stages)])
                current_stage = self._find_stage(run, stage_key) if run else None
                if run and current_stage:
                    decision = self.recovery.classify(str(exc))
                    current_stage.error_message = str(exc)
                    current_stage.failure_class = decision.failure_class
                    run.failure_class = decision.failure_class
                    task = await self._latest_task(session, run.id, current_stage.id)
                    if task:
                        task.status = StageStatus.failed.value
                        task.error_message = str(exc)
                        task.completed_at = utcnow()
                    if current_stage.attempt_count >= self.settings.max_stage_retries or not decision.recoverable:
                        current_stage.status = StageStatus.failed.value
                        run.status = RunStatus.failed.value
                        run.completed_at = utcnow()
                    else:
                        current_stage.status = StageStatus.pending.value
                    logger.error("[Worker %s] Run %s | Stage [%s] failed: %s (recoverable: %s)", self.worker_id, run.id, current_stage.stage_key, exc, decision.recoverable)
                    await self._record_event(
                        session,
                        run.id,
                        current_stage.id,
                        "stage.failed",
                        str(exc),
                        {
                            "stage_key": current_stage.stage_key,
                            "failure_class": decision.failure_class,
                            "next_action": decision.next_action,
                            "recoverable": decision.recoverable,
                        },
                    )
                    await self._record_event(
                        session,
                        run.id,
                        current_stage.id,
                        "log",
                        f"[{current_stage.stage_key}] Execution failed: {exc}",
                        {"stage_key": current_stage.stage_key, "error": str(exc)},
                    )
                    await session.flush()
                    await self.event_bus.publish_event(
                        run.id,
                        {
                            "event_type": "stage.failed",
                            "message": str(exc),
                            "payload": {
                                "stage_key": current_stage.stage_key,
                                "failure_class": decision.failure_class,
                                "recoverable": decision.recoverable,
                            },
                        },
                    )
            return True

    async def _acquire_next_run(self, session) -> Run | None:
        now = utcnow()
        result = await session.execute(
            select(Run)
            .options(selectinload(Run.stages))
            .where(
                Run.status.in_([RunStatus.queued.value, RunStatus.running.value]),
            )
            .order_by(Run.created_at.asc())
            .limit(20)
        )
        for run in result.scalars():
            leased_until = run.leased_until
            if leased_until and leased_until.tzinfo is None:
                leased_until = leased_until.replace(tzinfo=timezone.utc)
            if leased_until and leased_until > now and run.lease_owner not in (None, self.worker_id):
                continue
            run.lease_owner = self.worker_id
            run.leased_until = now + timedelta(seconds=self.settings.lease_seconds)
            run.heartbeat_at = now
            await session.flush()
            return run
        return None

    async def _ensure_stage_records(self, session, run: Run) -> None:
        existing = {stage.stage_key for stage in run.stages}
        for contract in STAGES:
            if contract.key not in existing:
                run.stages.append(
                    StageRecord(
                        run_id=run.id,
                        stage_key=contract.key,
                        stage_index=contract.index,
                        status=StageStatus.pending.value,
                    )
                )
        await session.flush()

    def _next_stage(self, run: Run) -> StageRecord | None:
        sorted_stages = sorted(run.stages, key=lambda item: item.stage_index)
        for stage in sorted_stages:
            if stage.status in {StageStatus.pending.value, StageStatus.running.value}:
                return stage
        return None

    def _find_stage(self, run: Run | None, stage_key: str) -> StageRecord | None:
        if not run:
            return None
        for stage in run.stages:
            if stage.stage_key == stage_key:
                return stage
        return None

    async def _latest_task(self, session, run_id: str, stage_id: str) -> Task | None:
        result = await session.execute(
            select(Task)
            .where(Task.run_id == run_id, Task.stage_id == stage_id)
            .order_by(Task.created_at.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()

    async def _record_event(
        self,
        session,
        run_id: str,
        stage_id: str | None,
        event_type: str,
        message: str,
        payload: dict | None = None,
    ) -> Event:
        event = Event(
            run_id=run_id,
            stage_id=stage_id,
            event_type=event_type,
            message=message,
            payload=payload or {},
        )
        session.add(event)
        await session.flush()
        return event
