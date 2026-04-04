from __future__ import annotations

from dataclasses import dataclass


@dataclass
class RecoveryDecision:
    failure_class: str
    recoverable: bool
    next_action: str
    degraded: bool = False


class RecoveryManager:
    def classify(self, error_message: str) -> RecoveryDecision:
        text = error_message.lower()
        if "api key" in text or "credential" in text or "unauthorized" in text:
            return RecoveryDecision("infra", False, "Stop and request valid credentials.")
        if "timeout" in text:
            return RecoveryDecision("resource", True, "Retry with longer timeout or smaller workload.", True)
        if "docker" in text or "ssh" in text:
            return RecoveryDecision("infra", True, "Fallback to local executor.", True)
        if "json" in text or "yaml" in text:
            return RecoveryDecision("reasoning", True, "Regenerate stage output with stricter structure.")
        if "citation" in text or "crossref" in text or "arxiv" in text:
            return RecoveryDecision("citation", True, "Retry with narrower literature query.", True)
        return RecoveryDecision("code", True, "Retry the stage with template fallback.", True)

