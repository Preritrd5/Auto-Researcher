from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Protocol


@dataclass
class ExecutionRequest:
    workdir: Path
    command: str
    env: dict[str, str] = field(default_factory=dict)
    timeout_seconds: int = 1800


@dataclass
class ExecutionResult:
    success: bool
    command: str
    returncode: int
    stdout: str
    stderr: str
    runtime_seconds: float
    metrics: dict
    executor_kind: str


class RuntimeExecutor(Protocol):
    kind: str

    async def execute(self, request: ExecutionRequest) -> ExecutionResult:
        ...

