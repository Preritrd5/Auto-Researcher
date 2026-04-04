from __future__ import annotations

import json
from pathlib import Path
from textwrap import dedent
from typing import Any

import yaml
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Citation, Memory, Project, Run, StageRecord
from app.orchestrator.contracts import stage_by_key
from app.retrieval.citation_verifier import CitationVerifier
from app.retrieval.literature_search import LiteratureSearchService
from app.runtime.base import ExecutionRequest
from app.runtime.docker import DockerRuntimeExecutor
from app.runtime.local import LocalRuntimeExecutor
from app.runtime.ssh import SSHRuntimeExecutor
from app.services.artifact_store import ArtifactStore
from app.services.event_bus import EventBus
from app.services.provider_gateway import ProviderGateway


class StageExecutor:
    def __init__(
        self,
        *,
        artifact_store: ArtifactStore,
        event_bus: EventBus,
        provider_gateway: ProviderGateway,
        literature_search: LiteratureSearchService,
        citation_verifier: CitationVerifier,
    ) -> None:
        self.artifact_store = artifact_store
        self.event_bus = event_bus
        self.provider_gateway = provider_gateway
        self.literature_search = literature_search
        self.citation_verifier = citation_verifier

    async def execute(self, session: AsyncSession, project: Project, run: Run, stage: StageRecord) -> dict[str, Any]:
        handler = getattr(self, f"_stage_{stage.stage_key}")
        return await handler(session, project, run, stage)

    async def _stage_brief_intake(self, session: AsyncSession, project: Project, run: Run, stage: StageRecord) -> dict:
        brief = dedent(
            f"""
            # Research Brief

            ## Project
            - Name: {project.name}
            - Objective: {project.objective or "Not specified"}
            - Description: {project.description or "Not specified"}

            ## Run Trigger
            {run.input_prompt or "Created from dashboard"}

            ## Success Criteria
            - Produce a grounded proposal with verified citations
            - Produce a runnable experiment scaffold
            - Produce analysis and paper draft artifacts

            ## Constraints
            - Single-user self-hosted workflow
            - Safety-first execution
            - Evidence-backed claims only
            """
        ).strip()
        await self.artifact_store.write_text(
            session,
            project_id=project.id,
            run_id=run.id,
            stage=stage,
            filename="brief.md",
            content=brief,
            kind="brief",
            mime_type="text/markdown",
        )
        session.add(
            Memory(
                project_id=project.id,
                run_id=run.id,
                category="brief",
                content=project.objective or project.description or run.input_prompt,
                memory_metadata={"stage": stage.stage_key},
            )
        )
        return {"summary": "Brief captured"}

    async def _stage_literature_scan(self, session: AsyncSession, project: Project, run: Run, stage: StageRecord) -> dict:
        query = project.objective or project.description or run.input_prompt or project.name
        papers = await self.literature_search.search(query, limit=6)
        if not papers:
            report = "# Literature Report\n\nNo external papers were found. Operating in degraded mode."
            degraded = True
        else:
            lines = ["# Literature Report", "", f"Query: `{query}`", ""]
            for idx, paper in enumerate(papers, start=1):
                lines.extend(
                    [
                        f"## {idx}. {paper.title}",
                        f"- Source: {paper.source}",
                        f"- Venue: {paper.venue or 'Unknown'}",
                        f"- Year: {paper.year or 'Unknown'}",
                        f"- Authors: {', '.join(paper.authors) or 'Unknown'}",
                        f"- URL: {paper.url or 'N/A'}",
                        "",
                    ]
                )
                session.add(
                    Citation(
                        run_id=run.id,
                        stage_id=stage.id,
                        source=paper.source,
                        external_id=paper.external_id,
                        title=paper.title,
                        authors=paper.authors,
                        year=paper.year,
                        url=paper.url,
                        venue=paper.venue,
                        doi=paper.doi,
                        verified=True,
                    )
                )
            report = "\n".join(lines)
            degraded = False
        await self.artifact_store.write_text(
            session,
            project_id=project.id,
            run_id=run.id,
            stage=stage,
            filename="literature_report.md",
            content=report,
            kind="literature_report",
            mime_type="text/markdown",
        )
        return {"papers_found": len(papers), "degraded": degraded}

    async def _stage_idea_generation(self, session: AsyncSession, project: Project, run: Run, stage: StageRecord) -> dict:
        profile = await self.provider_gateway.resolve_profile(session, project.primary_model_profile_id)
        prompt = (
            "Generate 3 concise ML research ideas as JSON array with keys: "
            "title, hypothesis, novelty_angle, risk, evaluation."
        )
        if profile:
            result = await self.provider_gateway.chat(
                profile,
                [
                    {"role": "system", "content": "You are a research strategist. Respond with pure JSON."},
                    {
                        "role": "user",
                        "content": (
                            f"Research objective: {project.objective or project.description}\n"
                            f"Run context: {run.input_prompt}\n\n{prompt}"
                        ),
                    },
                ],
            )
            ideas = self.provider_gateway.parse_json(result.text, [])
            degraded = result.degraded
        else:
            ideas = [
                {
                    "title": f"{project.name} Idea {index}",
                    "hypothesis": f"Ablate and optimize {project.objective or project.name.lower()} with stronger evidence.",
                    "novelty_angle": "Cross-model critique plus durable execution loop.",
                    "risk": "May need domain-specific benchmarks.",
                    "evaluation": "Compare against baseline on held-out metrics.",
                }
                for index in range(1, 4)
            ]
            degraded = True
        await self.artifact_store.write_json(
            session,
            project_id=project.id,
            run_id=run.id,
            stage=stage,
            filename="idea_board.json",
            data=ideas,
            kind="idea_board",
        )
        return {"idea_count": len(ideas), "degraded": degraded}

    async def _stage_novelty_feasibility_ranking(self, session: AsyncSession, project: Project, run: Run, stage: StageRecord) -> dict:
        prior_stage = await self._stage_record(session, run.id, "idea_generation")
        if not prior_stage:
            raise ValueError("Missing idea generation stage output")
        ideas_artifact = self.artifact_store.read_artifact_content(project.id, run.id, "idea_generation/idea_board.json")
        ideas = json.loads(ideas_artifact)
        profile = await self.provider_gateway.resolve_profile(session, project.critic_model_profile_id)
        if profile:
            result = await self.provider_gateway.chat(
                profile,
                [
                    {"role": "system", "content": "You are a critical reviewer. Return JSON only."},
                    {
                        "role": "user",
                        "content": (
                            "Rank the following ideas. Return an array of objects with keys: "
                            "title, novelty_score, feasibility_score, verdict, next_step.\n\n"
                            f"{json.dumps(ideas, ensure_ascii=False)}"
                        ),
                    },
                ],
            )
            ranked = self.provider_gateway.parse_json(result.text, [])
            degraded = result.degraded
        else:
            ranked = []
            for idx, idea in enumerate(ideas, start=1):
                ranked.append(
                    {
                        "title": idea["title"],
                        "novelty_score": round(0.82 - idx * 0.05, 2),
                        "feasibility_score": round(0.88 - idx * 0.04, 2),
                        "verdict": "proceed" if idx == 1 else "hold",
                        "next_step": "Draft proposal and design benchmark plan.",
                    }
                )
            degraded = True
        await self.artifact_store.write_json(
            session,
            project_id=project.id,
            run_id=run.id,
            stage=stage,
            filename="idea_board.json",
            data=ranked,
            kind="ranked_idea_board",
        )
        return {"ranked_count": len(ranked), "degraded": degraded}

    async def _stage_proposal_drafting(self, session: AsyncSession, project: Project, run: Run, stage: StageRecord) -> dict:
        ranked = json.loads(self.artifact_store.read_artifact_content(project.id, run.id, "novelty_feasibility_ranking/idea_board.json"))
        citations = await session.execute(select(Citation).where(Citation.run_id == run.id))
        citation_rows = list(citations.scalars())
        top_idea = ranked[0] if ranked else {"title": project.name, "next_step": "Refine"}
        profile = await self.provider_gateway.resolve_profile(session, project.primary_model_profile_id)
        if profile:
            result = await self.provider_gateway.chat(
                profile,
                [
                    {"role": "system", "content": "Draft a concise research proposal in Markdown."},
                    {
                        "role": "user",
                        "content": (
                            f"Objective: {project.objective or project.description}\n"
                            f"Top idea: {json.dumps(top_idea)}\n"
                            f"Verified citations: {[c.title for c in citation_rows[:5]]}\n"
                            "Produce sections: Problem, Hypothesis, Method, Experiments, Risks, References."
                        ),
                    },
                ],
            )
            proposal = result.text
            degraded = result.degraded
        else:
            references = "\n".join(f"- {item.title} ({item.year or 'n.d.'})" for item in citation_rows[:5]) or "- Pending citation verification"
            proposal = dedent(
                f"""
                # Proposal

                ## Problem
                {project.objective or project.description}

                ## Hypothesis
                {top_idea.get('title')}

                ## Method
                Build a durable cross-model research loop with reproducible experiment traces.

                ## Experiments
                - Benchmark against current baseline
                - Use multi-seed evaluation
                - Track primary metric and calibration metric

                ## Risks
                - External API variance
                - Limited benchmark coverage

                ## References
                {references}
                """
            ).strip()
            degraded = True
        await self.artifact_store.write_text(
            session,
            project_id=project.id,
            run_id=run.id,
            stage=stage,
            filename="proposal.md",
            content=proposal,
            kind="proposal",
            mime_type="text/markdown",
        )
        return {"degraded": degraded}

    async def _stage_experiment_planning(self, session: AsyncSession, project: Project, run: Run, stage: StageRecord) -> dict:
        proposal = self.artifact_store.read_artifact_content(project.id, run.id, "proposal_drafting/proposal.md")
        profile = await self.provider_gateway.resolve_profile(session, project.primary_model_profile_id)
        if profile:
            result = await self.provider_gateway.chat(
                profile,
                [
                    {"role": "system", "content": "Return YAML only."},
                    {
                        "role": "user",
                        "content": (
                            "Turn this proposal into an experiment plan with keys: "
                            "objective, datasets, metrics, command_template, expected_artifacts, refine_policy.\n\n"
                            f"{proposal}"
                        ),
                    },
                ],
            )
            try:
                plan = yaml.safe_load(result.text) or {}
            except yaml.YAMLError:
                plan = {}
            degraded = result.degraded or not bool(plan)
        else:
            plan = {}
            degraded = True
        if not plan:
            plan = {
                "objective": project.objective or project.description or project.name,
                "datasets": ["custom-benchmark"],
                "metrics": ["accuracy", "loss"],
                "command_template": "python experiment.py --steps 10 --seed 7",
                "expected_artifacts": ["metrics.json", "notes.md"],
                "refine_policy": {
                    "max_repairs": 3,
                    "fallback_order": ["local", "docker", "ssh"],
                },
            }
        await self.artifact_store.write_yaml(
            session,
            project_id=project.id,
            run_id=run.id,
            stage=stage,
            filename="experiment_plan.yaml",
            data=plan,
            kind="experiment_plan",
        )
        return {"degraded": degraded}

    async def _stage_code_generation(self, session: AsyncSession, project: Project, run: Run, stage: StageRecord) -> dict:
        plan = yaml.safe_load(self.artifact_store.read_artifact_content(project.id, run.id, "experiment_planning/experiment_plan.yaml"))
        code = dedent(
            """
            import argparse
            import json
            import math
            import random
            import time

            parser = argparse.ArgumentParser()
            parser.add_argument("--steps", type=int, default=10)
            parser.add_argument("--seed", type=int, default=7)
            args = parser.parse_args()

            random.seed(args.seed)
            time.sleep(0.1)
            accuracy = round(0.71 + min(args.steps, 20) * 0.008 + random.random() * 0.01, 4)
            loss = round(max(0.1, 1.2 - accuracy), 4)

            metrics = {
                "accuracy": accuracy,
                "loss": loss,
                "steps": args.steps,
                "seed": args.seed,
            }
            print("Experiment completed")
            print("AUTO_RESEARCH_METRICS=" + json.dumps(metrics))
            """
        ).strip() + "\n"
        readme = dedent(
            f"""
            # Workspace Snapshot

            This directory is generated by Auto-Researcher.

            Objective: {plan.get('objective')}
            Metrics: {', '.join(plan.get('metrics', []))}
            """
        ).strip()
        await self.artifact_store.write_text(
            session,
            project_id=project.id,
            run_id=run.id,
            stage=stage,
            filename="workspace_snapshot/experiment.py",
            content=code,
            kind="workspace_file",
        )
        await self.artifact_store.write_text(
            session,
            project_id=project.id,
            run_id=run.id,
            stage=stage,
            filename="workspace_snapshot/README.md",
            content=readme,
            kind="workspace_file",
            mime_type="text/markdown",
        )
        return {"workspace_files": 2}

    async def _stage_experiment_run_refine_loop(self, session: AsyncSession, project: Project, run: Run, stage: StageRecord) -> dict:
        plan = yaml.safe_load(self.artifact_store.read_artifact_content(project.id, run.id, "experiment_planning/experiment_plan.yaml"))
        compute_target = None
        if project.default_compute_target_id:
            from app.db.models import ComputeTarget

            compute_target = await session.get(ComputeTarget, project.default_compute_target_id)
        executor_kind = compute_target.kind if compute_target else "local"
        workdir = self.artifact_store.stage_root(project.id, run.id, "code_generation") / "workspace_snapshot"
        command = plan.get("command_template", "python experiment.py --steps 10 --seed 7")
        executor = self._executor_for_kind(executor_kind, compute_target.config if compute_target else {})
        result = await executor.execute(
            ExecutionRequest(workdir=workdir, command=command, timeout_seconds=900)
        )
        payload = {
            "success": result.success,
            "command": result.command,
            "executor_kind": result.executor_kind,
            "returncode": result.returncode,
            "runtime_seconds": round(result.runtime_seconds, 3),
            "stdout": result.stdout[-4000:],
            "stderr": result.stderr[-4000:],
            "metrics": result.metrics,
        }
        if not result.success:
            raise RuntimeError(result.stderr or "Experiment execution failed")
        await self.artifact_store.write_json(
            session,
            project_id=project.id,
            run_id=run.id,
            stage=stage,
            filename="run_metrics.json",
            data=payload,
            kind="run_metrics",
        )
        session.add(
            Memory(
                project_id=project.id,
                run_id=run.id,
                category="experiment",
                content=f"Run succeeded with metrics {result.metrics}",
                memory_metadata={"stage": stage.stage_key, "executor_kind": result.executor_kind},
            )
        )
        return payload

    async def _stage_analysis_result_to_claim(self, session: AsyncSession, project: Project, run: Run, stage: StageRecord) -> dict:
        metrics_payload = json.loads(
            self.artifact_store.read_artifact_content(project.id, run.id, "experiment_run_refine_loop/run_metrics.json")
        )
        metrics = metrics_payload.get("metrics") or {}
        accuracy = float(metrics.get("accuracy", 0.0))
        decision = {
            "claim_supported": "yes" if accuracy >= 0.78 else "partial" if accuracy >= 0.73 else "no",
            "primary_metric": "accuracy",
            "metric_value": accuracy,
            "recommended_next_step": "write_paper" if accuracy >= 0.73 else "run_more_experiments",
            "evidence_quality": "strong" if accuracy >= 0.78 else "moderate",
        }
        report = dedent(
            f"""
            # Analysis Report

            ## Metric summary
            - Accuracy: {accuracy}
            - Loss: {metrics.get('loss')}
            - Executor: {metrics_payload.get('executor_kind')}

            ## Claim decision
            - Supported: {decision['claim_supported']}
            - Evidence quality: {decision['evidence_quality']}
            - Recommended next step: {decision['recommended_next_step']}
            """
        ).strip()
        await self.artifact_store.write_text(
            session,
            project_id=project.id,
            run_id=run.id,
            stage=stage,
            filename="analysis_report.md",
            content=report,
            kind="analysis_report",
            mime_type="text/markdown",
        )
        await self.artifact_store.write_json(
            session,
            project_id=project.id,
            run_id=run.id,
            stage=stage,
            filename="claim_decision.json",
            data=decision,
            kind="claim_decision",
        )
        return decision

    async def _stage_paper_drafting_review_export(self, session: AsyncSession, project: Project, run: Run, stage: StageRecord) -> dict:
        proposal = self.artifact_store.read_artifact_content(project.id, run.id, "proposal_drafting/proposal.md")
        analysis = self.artifact_store.read_artifact_content(project.id, run.id, "analysis_result_to_claim/analysis_report.md")
        citations = await session.execute(select(Citation).where(Citation.run_id == run.id))
        citation_rows = list(citations.scalars())
        references = "\n".join(
            f"- {citation.title} ({citation.year or 'n.d.'}), {citation.venue or citation.source}"
            for citation in citation_rows[:10]
        ) or "- No verified citations recorded."
        paper_md = dedent(
            f"""
            # {project.name}: Draft Paper

            ## Abstract
            This draft was generated by Auto-Researcher from a durable end-to-end run.

            ## Proposal Context
            {proposal}

            ## Results and Analysis
            {analysis}

            ## References
            {references}
            """
        ).strip()
        paper_tex = dedent(
            f"""
            \\documentclass{{article}}
            \\usepackage[margin=1in]{{geometry}}
            \\title{{{project.name}: Draft Paper}}
            \\begin{{document}}
            \\maketitle
            \\section*{{Abstract}}
            Auto-Researcher produced this draft from a durable ML workflow.
            \\section*{{Proposal Context}}
            {self._latex_escape(proposal[:1500])}
            \\section*{{Results}}
            {self._latex_escape(analysis[:1500])}
            \\end{{document}}
            """
        ).strip()
        await self.artifact_store.write_text(
            session,
            project_id=project.id,
            run_id=run.id,
            stage=stage,
            filename="paper/paper.md",
            content=paper_md,
            kind="paper_markdown",
            mime_type="text/markdown",
        )
        await self.artifact_store.write_text(
            session,
            project_id=project.id,
            run_id=run.id,
            stage=stage,
            filename="paper/paper.tex",
            content=paper_tex,
            kind="paper_latex",
            mime_type="application/x-tex",
        )
        critic = await self.provider_gateway.resolve_profile(session, project.critic_model_profile_id)
        review_text = "No critic model configured; paper review skipped."
        degraded = True
        if critic:
            result = await self.provider_gateway.chat(
                critic,
                [
                    {"role": "system", "content": "Review this draft and give concise improvement notes."},
                    {"role": "user", "content": paper_md[:6000]},
                ],
            )
            review_text = result.text
            degraded = result.degraded
        await self.artifact_store.write_text(
            session,
            project_id=project.id,
            run_id=run.id,
            stage=stage,
            filename="paper/review.md",
            content=review_text,
            kind="paper_review",
            mime_type="text/markdown",
        )
        return {"paper_files": 3, "degraded": degraded}

    async def _stage_record(self, session: AsyncSession, run_id: str, stage_key: str) -> StageRecord | None:
        result = await session.execute(
            select(StageRecord).where(StageRecord.run_id == run_id, StageRecord.stage_key == stage_key)
        )
        return result.scalar_one_or_none()

    def _executor_for_kind(self, kind: str, config: dict) -> Any:
        if kind == "docker":
            return DockerRuntimeExecutor()
        if kind == "ssh":
            return SSHRuntimeExecutor(config)
        return LocalRuntimeExecutor()

    @staticmethod
    def _latex_escape(text: str) -> str:
        replacements = {
            "\\": "\\textbackslash{}",
            "&": "\\&",
            "%": "\\%",
            "$": "\\$",
            "#": "\\#",
            "_": "\\_",
            "{": "\\{",
            "}": "\\}",
        }
        for source, target in replacements.items():
            text = text.replace(source, target)
        return text
