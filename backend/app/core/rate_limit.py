from __future__ import annotations

import time
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Dict, List


@dataclass
class FailedAttemptRecord:
    timestamps: List[float] = field(default_factory=list)
    locked_until: float = 0.0


class LoginRateLimiter:
    """
    In-memory sliding window rate limiter to protect authentication endpoints
    from brute-force and credential stuffing attacks.
    """

    def __init__(self, max_attempts: int = 5, window_seconds: int = 300, lockout_seconds: int = 900) -> None:
        self.max_attempts = max_attempts
        self.window_seconds = window_seconds
        self.lockout_seconds = lockout_seconds
        self._records: Dict[str, FailedAttemptRecord] = defaultdict(FailedAttemptRecord)

    def is_locked(self, key: str) -> tuple[bool, int]:
        now = time.time()
        record = self._records[key]

        # Check if active lockout period is active
        if record.locked_until > now:
            remaining = int(record.locked_until - now)
            return True, remaining

        # Purge timestamps outside the window
        record.timestamps = [t for t in record.timestamps if now - t < self.window_seconds]
        return False, 0

    def record_failure(self, key: str) -> tuple[bool, int]:
        now = time.time()
        record = self._records[key]

        # Purge old timestamps
        record.timestamps = [t for t in record.timestamps if now - t < self.window_seconds]
        record.timestamps.append(now)

        if len(record.timestamps) >= self.max_attempts:
            record.locked_until = now + self.lockout_seconds
            record.timestamps.clear()
            return True, self.lockout_seconds

        remaining_attempts = max(0, self.max_attempts - len(record.timestamps))
        return False, remaining_attempts

    def clear(self, key: str) -> None:
        if key in self._records:
            del self._records[key]


# Global rate limiter instance: 5 attempts per 5 minutes; 15-minute lockout
login_limiter = LoginRateLimiter(max_attempts=5, window_seconds=300, lockout_seconds=900)
