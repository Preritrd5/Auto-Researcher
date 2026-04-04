from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class StageContract:
    index: int
    key: str
    label: str
    artifact_targets: tuple[str, ...]


STAGES: tuple[StageContract, ...] = (
    StageContract(1, "brief_intake", "Brief Intake", ("brief.md",)),
    StageContract(2, "literature_scan", "Literature Scan", ("literature_report.md",)),
    StageContract(3, "idea_generation", "Idea Generation", ("idea_board.json",)),
    StageContract(4, "novelty_feasibility_ranking", "Novelty & Feasibility Ranking", ("idea_board.json",)),
    StageContract(5, "proposal_drafting", "Proposal Drafting", ("proposal.md",)),
    StageContract(6, "experiment_planning", "Experiment Planning", ("experiment_plan.yaml",)),
    StageContract(7, "code_generation", "Code Generation", ("workspace_snapshot/",)),
    StageContract(8, "experiment_run_refine_loop", "Experiment Run + Refine Loop", ("run_metrics.json",)),
    StageContract(9, "analysis_result_to_claim", "Analysis / Result To Claim", ("analysis_report.md", "claim_decision.json")),
    StageContract(10, "paper_drafting_review_export", "Paper Drafting / Review / Export", ("paper/",)),
)


def stage_by_key(stage_key: str) -> StageContract:
    for stage in STAGES:
        if stage.key == stage_key:
            return stage
    raise KeyError(stage_key)

