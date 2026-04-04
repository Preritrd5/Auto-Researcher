from __future__ import annotations

from pydantic import BaseModel

from app.schemas.common import ORMModel


class ArtifactRead(ORMModel):
    id: str
    run_id: str
    stage_id: str | None = None
    kind: str
    relative_path: str
    mime_type: str
    checksum: str
    size_bytes: int
    artifact_metadata: dict


class ArtifactContent(BaseModel):
    artifact: ArtifactRead
    content: str
