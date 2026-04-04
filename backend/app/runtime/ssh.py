from __future__ import annotations

from pathlib import Path
import shlex

from app.runtime.base import ExecutionRequest, ExecutionResult
from app.runtime.local import LocalRuntimeExecutor


class SSHRuntimeExecutor:
    kind = "ssh"

    def __init__(self, config: dict) -> None:
        self.config = config

    async def execute(self, request: ExecutionRequest) -> ExecutionResult:
        host = self.config.get("host")
        user = self.config.get("user")
        remote_workdir = self.config.get("remote_workdir", "/tmp/auto-researcher")
        key_path = self.config.get("key_path", "")
        if not host or not user:
            raise ValueError("SSH target requires host and user")
        ssh_cmd = f"ssh -i {shlex.quote(key_path)}" if key_path else "ssh"
        request.workdir = Path(request.workdir)
        sync_command = (
            f'rsync -az -e "{ssh_cmd}" {shlex.quote(str(request.workdir))}/ '
            f"{user}@{host}:{shlex.quote(remote_workdir)}/"
        )
        remote_command = (
            f"{ssh_cmd} {user}@{host} "
            f"{shlex.quote(f'cd {remote_workdir} && {request.command}')}"
        )
        executor = LocalRuntimeExecutor()
        sync_result = await executor.execute(
            ExecutionRequest(workdir=request.workdir, command=sync_command, timeout_seconds=300)
        )
        if not sync_result.success:
            return sync_result
        return await executor.execute(
            ExecutionRequest(workdir=request.workdir, command=remote_command, timeout_seconds=request.timeout_seconds)
        )
