from app.orchestrator.recovery import RecoveryManager
from app.runtime.metrics import extract_metrics


def test_recovery_manager_classifies_credentials() -> None:
    decision = RecoveryManager().classify("Missing API key for profile")
    assert decision.failure_class == "infra"
    assert decision.recoverable is False


def test_extract_metrics_parses_structured_line() -> None:
    stdout = 'hello\nAUTO_RESEARCH_METRICS={"accuracy": 0.82, "loss": 0.18}\n'
    metrics = extract_metrics(stdout)
    assert metrics["accuracy"] == 0.82
    assert metrics["loss"] == 0.18

