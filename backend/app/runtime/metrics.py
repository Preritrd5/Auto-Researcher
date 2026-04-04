from __future__ import annotations

import json
import re


METRICS_PREFIX = "AUTO_RESEARCH_METRICS="


def extract_metrics(stdout: str) -> dict:
    for line in reversed(stdout.splitlines()):
        if line.startswith(METRICS_PREFIX):
            try:
                return json.loads(line[len(METRICS_PREFIX) :].strip())
            except json.JSONDecodeError:
                continue
    match = re.search(r"accuracy[:=]\s*([0-9.]+)", stdout, re.IGNORECASE)
    if match:
        return {"accuracy": float(match.group(1))}
    return {}

