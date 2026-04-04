from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db_session
from app.db.models import Artifact, Project, Run
from app.schemas.artifact import ArtifactContent, ArtifactRead
from app.services.artifact_store import ArtifactStore

router = APIRouter(prefix="/artifacts", tags=["artifacts"])
artifact_store = ArtifactStore()


@router.get("", response_model=list[ArtifactRead])
async def list_artifacts(run_id: str, session: AsyncSession = Depends(get_db_session)) -> list[ArtifactRead]:
    result = await session.execute(select(Artifact).where(Artifact.run_id == run_id).order_by(Artifact.created_at.asc()))
    return list(result.scalars())


@router.get("/{artifact_id}", response_model=ArtifactContent)
async def get_artifact(artifact_id: str, session: AsyncSession = Depends(get_db_session)) -> ArtifactContent:
    artifact = await session.get(Artifact, artifact_id)
    if not artifact:
        raise HTTPException(status_code=404, detail="Artifact not found")
    run = await session.get(Run, artifact.run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    project = await session.get(Project, run.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    content = artifact_store.read_artifact_content(project.id, run.id, artifact.relative_path)
    return ArtifactContent(artifact=artifact, content=content)

