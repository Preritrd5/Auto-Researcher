from __future__ import annotations

import asyncio
import os
import time

from app.runtime.base import ExecutionRequest, ExecutionResult
from app.runtime.metrics import extract_metrics


class LocalRuntimeExecutor:
    kind = "local"

    async def execute(self, request: ExecutionRequest) -> ExecutionResult:
        started = time.perf_counter()
        process = await asyncio.create_subprocess_shell(
            request.command,
            cwd=str(request.workdir),
            env={**os.environ, **request.env},
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        try:
            stdout, stderr = await asyncio.wait_for(process.communicate(), timeout=request.timeout_seconds)
        except TimeoutError:
            process.kill()
            await process.wait()
            return ExecutionResult(
                success=False,
                command=request.command,
                returncode=-1,
                stdout="",
                stderr="Execution timed out",
                runtime_seconds=time.perf_counter() - started,
                metrics={},
                executor_kind=self.kind,
            )
        stdout_text = stdout.decode("utf-8", errors="replace")
        stderr_text = stderr.decode("utf-8", errors="replace")
        return ExecutionResult(
            success=process.returncode == 0,
            command=request.command,
            returncode=process.returncode or 0,
            stdout=stdout_text,
            stderr=stderr_text,
            runtime_seconds=time.perf_counter() - started,
            metrics=extract_metrics(stdout_text),
            executor_kind=self.kind,
        )

