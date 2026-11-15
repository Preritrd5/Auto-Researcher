from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db_session
from app.db.models import Artifact, Project, Run, User
from app.schemas.artifact import ArtifactContent, ArtifactRead
from app.services.artifact_store import ArtifactStore

router = APIRouter(prefix="/artifacts", tags=["artifacts"])
artifact_store = ArtifactStore()


@router.get("", response_model=list[ArtifactRead])
async def list_artifacts(
    run_id: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> list[ArtifactRead]:
    run = await session.get(Run, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    proj = await session.get(Project, run.project_id)
    if proj and proj.user_id and proj.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    result = await session.execute(
        select(Artifact).where(Artifact.run_id == run_id).order_by(Artifact.created_at.asc())
    )
    return list(result.scalars())


@router.get("/{artifact_id}", response_model=ArtifactContent)
async def get_artifact(
    artifact_id: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> ArtifactContent:
    artifact = await session.get(Artifact, artifact_id)
    if not artifact:
        raise HTTPException(status_code=404, detail="Artifact not found")

    run = await session.get(Run, artifact.run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    project = await session.get(Project, run.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if project.user_id and project.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    content = artifact_store.read_artifact_content(project.id, run.id, artifact.relative_path)
    return ArtifactContent(artifact=artifact, content=content)


@router.get("/{artifact_id}/download")
async def download_artifact(
    artifact_id: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
) -> FileResponse:
    artifact = await session.get(Artifact, artifact_id)
    if not artifact:
        raise HTTPException(status_code=404, detail="Artifact not found")

    run = await session.get(Run, artifact.run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    project = await session.get(Project, run.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if project.user_id and project.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    # Locate actual file with strict path traversal verification
    root = artifact_store.run_root(project.id, run.id).resolve()
    file_path = (root / artifact.relative_path).resolve()
    if not file_path.is_relative_to(root):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Path traversal forbidden")
    if not file_path.is_file():
        raise HTTPException(status_code=404, detail="Artifact file not found on disk")

    filename = Path(artifact.relative_path).name
    return FileResponse(
        path=str(file_path),
        filename=filename,
        media_type=artifact.mime_type or "application/octet-stream",
    )

