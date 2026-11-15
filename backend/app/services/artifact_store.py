from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

import yaml
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.db.models import Artifact, StageRecord


class ArtifactStore:
    def __init__(self) -> None:
        self.settings = get_settings()

    def run_root(self, project_id: str, run_id: str) -> Path:
        return self.settings.artifacts_root / project_id / run_id

    def stage_root(self, project_id: str, run_id: str, stage_key: str) -> Path:
        path = self.run_root(project_id, run_id) / stage_key
        path.mkdir(parents=True, exist_ok=True)
        return path

    async def write_text(
        self,
        session: AsyncSession,
        *,
        project_id: str,
        run_id: str,
        stage: StageRecord,
        filename: str,
        content: str,
        kind: str,
        mime_type: str = "text/plain",
        metadata: dict[str, Any] | None = None,
    ) -> Artifact:
        stage_dir = self.stage_root(project_id, run_id, stage.stage_key)
        path = stage_dir / filename
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")
        return await self._persist_artifact(
            session=session,
            run_id=run_id,
            stage=stage,
            path=path,
            project_id=project_id,
            kind=kind,
            mime_type=mime_type,
            metadata=metadata or {},
        )

    async def write_json(
        self,
        session: AsyncSession,
        *,
        project_id: str,
        run_id: str,
        stage: StageRecord,
        filename: str,
        data: Any,
        kind: str,
        metadata: dict[str, Any] | None = None,
    ) -> Artifact:
        return await self.write_text(
            session,
            project_id=project_id,
            run_id=run_id,
            stage=stage,
            filename=filename,
            content=json.dumps(data, indent=2, ensure_ascii=False),
            kind=kind,
            mime_type="application/json",
            metadata=metadata,
        )

    async def write_yaml(
        self,
        session: AsyncSession,
        *,
        project_id: str,
        run_id: str,
        stage: StageRecord,
        filename: str,
        data: Any,
        kind: str,
        metadata: dict[str, Any] | None = None,
    ) -> Artifact:
        return await self.write_text(
            session,
            project_id=project_id,
            run_id=run_id,
            stage=stage,
            filename=filename,
            content=yaml.safe_dump(data, sort_keys=False, allow_unicode=True),
            kind=kind,
            mime_type="application/yaml",
            metadata=metadata,
        )

    async def _persist_artifact(
        self,
        *,
        session: AsyncSession,
        run_id: str,
        stage: StageRecord,
        path: Path,
        project_id: str,
        kind: str,
        mime_type: str,
        metadata: dict[str, Any],
    ) -> Artifact:
        checksum = hashlib.sha256(path.read_bytes()).hexdigest()
        relative_path = path.relative_to(self.run_root(project_id, run_id)).as_posix()
        artifact = Artifact(
            run_id=run_id,
            stage_id=stage.id,
            kind=kind,
            relative_path=relative_path,
            mime_type=mime_type,
            checksum=checksum,
            size_bytes=path.stat().st_size,
            artifact_metadata=metadata,
        )
        session.add(artifact)
        await session.flush()
        return artifact

    def read_artifact_content(self, project_id: str, run_id: str, relative_path: str) -> str:
        root = self.run_root(project_id, run_id).resolve()
        path = (root / relative_path).resolve()
        if not path.is_relative_to(root):
            raise PermissionError("Path traversal detected")
        if not path.is_file():
            raise FileNotFoundError(f"Artifact file not found: {relative_path}")
        return path.read_text(encoding="utf-8")
