from __future__ import annotations

import shlex

from app.runtime.base import ExecutionRequest, ExecutionResult
from app.runtime.local import LocalRuntimeExecutor


class DockerRuntimeExecutor:
    kind = "docker"

    async def execute(self, request: ExecutionRequest) -> ExecutionResult:
        wrapped = ExecutionRequest(
            workdir=request.workdir,
            command=(
                f"docker run --rm -v {shlex.quote(str(request.workdir))}:/workspace "
                f"-w /workspace python:3.12-slim sh -lc {shlex.quote(request.command)}"
            ),
            env=request.env,
            timeout_seconds=request.timeout_seconds,
        )
        return await LocalRuntimeExecutor().execute(wrapped)
