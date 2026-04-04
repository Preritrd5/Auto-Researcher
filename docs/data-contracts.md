# Data Contracts

## Stage artifact contract

| Stage | Key | Primary artifact |
| --- | --- | --- |
| 1 | `brief_intake` | `brief.md` |
| 2 | `literature_scan` | `literature_report.md` |
| 3 | `idea_generation` | `idea_board.json` |
| 4 | `novelty_feasibility_ranking` | `idea_board.json` |
| 5 | `proposal_drafting` | `proposal.md` |
| 6 | `experiment_planning` | `experiment_plan.yaml` |
| 7 | `code_generation` | `workspace_snapshot/` |
| 8 | `experiment_run_refine_loop` | `run_metrics.json` |
| 9 | `analysis_result_to_claim` | `analysis_report.md`, `claim_decision.json` |
| 10 | `paper_drafting_review_export` | `paper/` |

## Core tables

- `projects`
- `runs`
- `stages`
- `tasks`
- `artifacts`
- `events`
- `model_profiles`
- `compute_targets`
- `budgets`
- `memories`
- `citations`

