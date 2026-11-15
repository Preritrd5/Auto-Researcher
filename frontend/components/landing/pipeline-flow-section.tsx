"use client";

import React, { useState } from "react";
import {
  FileText,
  Search,
  Lightbulb,
  Award,
  BookOpen,
  CalendarCheck,
  Code2,
  Terminal,
  BarChart3,
  FileCheck2,
  ArrowRight,
  CheckCircle2
} from "lucide-react";

const STAGES = [
  {
    index: 1,
    key: "brief_intake",
    name: "Brief Intake",
    icon: FileText,
    tagline: "Problem formulation & scope boundary",
    artifact: "brief.md",
    description: "Transforms rough research ideas into structured hypotheses with explicit success criteria, constraints, and operational budgets.",
    inputs: "User prompt, research problem description, target domains",
    outputs: "Structured research brief with bounded claims and scope metrics"
  },
  {
    index: 2,
    key: "literature_scan",
    name: "Literature Scan",
    icon: Search,
    tagline: "Live search on arXiv & Crossref",
    artifact: "literature_report.md",
    description: "Queries arXiv API, Crossref API, and Semantic Scholar to discover prior work, retrieve author lists, DOIs, and prevent redundant experiments.",
    inputs: "Keyword extracts from Brief Intake",
    outputs: "Synthesized literature survey with deduplicated, verified citations"
  },
  {
    index: 3,
    key: "idea_generation",
    name: "Idea Generation",
    icon: Lightbulb,
    tagline: "Methodological variations & novel angles",
    artifact: "idea_board.json",
    description: "Generates multiple competing technical architectures, loss formulations, and dataset variations grounded in the discovered literature.",
    inputs: "Literature survey & brief objectives",
    outputs: "Multi-hypothesis candidate board with technical trade-offs"
  },
  {
    index: 4,
    key: "novelty_ranking",
    name: "Novelty & Feasibility Ranking",
    icon: Award,
    tagline: "Dual-model adversarial scoring",
    artifact: "idea_board.json (ranked)",
    description: "Primary and Critic LLMs independently evaluate each candidate for technical novelty, compute feasibility, and likelihood of empirical success.",
    inputs: "Generated idea board candidates",
    outputs: "Top-ranked champion hypothesis with explicit risk mitigation plan"
  },
  {
    index: 5,
    key: "proposal_drafting",
    name: "Proposal Drafting",
    icon: BookOpen,
    tagline: "Formal research proposal with citations",
    artifact: "proposal.md",
    description: "Drafts a complete scientific proposal detailing the problem statement, related works, proposed methodology, baseline models, and evaluation protocol.",
    inputs: "Ranked champion idea & literature references",
    outputs: "Full academic research proposal with verified reference list"
  },
  {
    index: 6,
    key: "experiment_planning",
    name: "Experiment Planning",
    icon: CalendarCheck,
    tagline: "Reproducible compute specification",
    artifact: "experiment_plan.yaml",
    description: "Decomposes the proposal into concrete executable steps: dataset preprocessing, environment requirements, hyperparameter grid, and metrics.",
    inputs: "Proposal methodology & compute constraints",
    outputs: "Declarative YAML experiment schedule and validation checkpoints"
  },
  {
    index: 7,
    key: "code_generation",
    name: "Code Generation",
    icon: Code2,
    tagline: "Clean, runnable Python codebase",
    artifact: "workspace_snapshot/",
    description: "Generates production-grade PyTorch/Python experiment scripts, logging hooks, and seed configs conforming to the experiment plan.",
    inputs: "Experiment plan & hardware target capabilities",
    outputs: "Self-contained experiment directory ready for execution"
  },
  {
    index: 8,
    key: "experiment_loop",
    name: "Experiment Run & Repair Loop",
    icon: Terminal,
    tagline: "Execution with automated traceback repair",
    artifact: "run_metrics.json",
    description: "Executes code on the assigned target (local/Docker/SSH). If runtime errors occur, the repair router inspects logs, patches scripts, and retries up to 3 times.",
    inputs: "Executable workspace & runtime compute target",
    outputs: "Raw execution telemetry, loss curves, and output benchmark metrics"
  },
  {
    index: 9,
    key: "analysis_claims",
    name: "Analysis & Claim Decision",
    icon: BarChart3,
    tagline: "Empirical validation & statistical claims",
    artifact: "analysis_report.md",
    description: "Calculates statistical significance, benchmark comparisons, and determines whether the empirical results support the initial hypotheses.",
    inputs: "Final run metrics & baseline comparison scores",
    outputs: "Rigorous analysis report and definitive claim decision matrix"
  },
  {
    index: 10,
    key: "paper_export",
    name: "Paper Drafting & Export",
    icon: FileCheck2,
    tagline: "Complete multi-section academic paper",
    artifact: "paper/ (LaTeX & Markdown)",
    description: "Synthesizes all stage artifacts into a publication-ready academic manuscript complete with abstract, tables, figures, methodology, and verified bibliography.",
    inputs: "All previous 9 stage outputs & verified citations",
    outputs: "Publication-ready LaTeX and Markdown academic paper bundle"
  }
];

export function PipelineFlowSection() {
  const [selectedStage, setSelectedStage] = useState(STAGES[0]);

  return (
    <section id="how-it-works" className="border-t border-border/80 bg-surface/50 py-20 md:py-28">
      <div id="pipeline" className="mx-auto max-w-7xl px-4 md:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-accent">
            How It Works · 10-Stage Lifecycle
          </div>
          <h2 className="mt-4 font-serif text-3xl font-bold tracking-tight text-ink sm:text-4xl md:text-5xl">
            Autonomous Discovery Step-by-Step
          </h2>
          <p className="mt-4 text-base text-muted md:text-lg">
            Unlike simple single-turn prompts, Auto-Researcher executes a structured, durable state machine where each stage verifies outputs before passing checkpoints to the next.
          </p>
        </div>

        {/* Stage Selector Grid */}
        <div className="mt-14 grid gap-3 sm:grid-cols-2 md:grid-cols-5">
          {STAGES.map((stage) => {
            const Icon = stage.icon;
            const isSelected = selectedStage.index === stage.index;
            return (
              <button
                key={stage.index}
                onClick={() => setSelectedStage(stage)}
                className={`flex flex-col items-start rounded-2xl p-4 text-left transition ${
                  isSelected
                    ? "bg-accent text-white shadow-glow"
                    : "glass-panel bg-white/70 text-ink hover:bg-white"
                }`}
              >
                <div className="flex w-full items-center justify-between">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-xl text-xs font-bold ${
                      isSelected ? "bg-white/20 text-white" : "bg-accent/10 text-accent"
                    }`}
                  >
                    0{stage.index}
                  </div>
                  <Icon className={`h-4 w-4 ${isSelected ? "text-white" : "text-muted"}`} />
                </div>
                <div className="mt-3 text-xs font-semibold tracking-wide">
                  {stage.name}
                </div>
                <div className={`mt-1 text-[11px] truncate w-full ${isSelected ? "text-white/80" : "text-muted"}`}>
                  {stage.artifact}
                </div>
              </button>
            );
          })}
        </div>

        {/* Selected Stage Detail Panel */}
        <div className="glass-panel mt-8 rounded-[32px] border border-border/80 bg-surface/90 p-6 md:p-10 shadow-panel">
          <div className="grid gap-8 lg:grid-cols-12">
            <div className="lg:col-span-7 space-y-4">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-accent text-white font-mono text-sm font-bold">
                  {selectedStage.index}
                </span>
                <div>
                  <h3 className="font-serif text-2xl font-bold text-ink sm:text-3xl">
                    {selectedStage.name}
                  </h3>
                  <p className="text-xs font-semibold uppercase tracking-wider text-accent">
                    {selectedStage.tagline}
                  </p>
                </div>
              </div>

              <p className="text-sm leading-relaxed text-muted sm:text-base">
                {selectedStage.description}
              </p>

              <div className="grid gap-4 pt-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-border bg-white/60 p-4">
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted">
                    Stage Inputs
                  </div>
                  <div className="mt-1.5 text-xs text-ink leading-relaxed">
                    {selectedStage.inputs}
                  </div>
                </div>

                <div className="rounded-2xl border border-border bg-white/60 p-4">
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted">
                    Verified Outputs
                  </div>
                  <div className="mt-1.5 text-xs text-ink leading-relaxed">
                    {selectedStage.outputs}
                  </div>
                </div>
              </div>
            </div>

            {/* Artifact Showcase */}
            <div className="lg:col-span-5 flex flex-col justify-between rounded-2xl border border-border/80 bg-white/80 p-5 shadow-sm">
              <div>
                <div className="flex items-center justify-between border-b border-border/70 pb-3">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted">
                    Target Artifact
                  </span>
                  <span className="font-mono text-xs font-bold text-accent">
                    {selectedStage.artifact}
                  </span>
                </div>
                <div className="mt-4 space-y-2">
                  <div className="flex items-center gap-2 text-xs text-muted">
                    <CheckCircle2 className="h-4 w-4 text-success" />
                    <span>Written to durable disk storage</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted">
                    <CheckCircle2 className="h-4 w-4 text-success" />
                    <span>Checksum &amp; SHA-256 registered in DB</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted">
                    <CheckCircle2 className="h-4 w-4 text-success" />
                    <span>Real-time inspectable in Artifacts pane</span>
                  </div>
                </div>
              </div>

              <div className="mt-6 rounded-xl bg-surface p-3 font-mono text-[11px] text-muted border border-border/60">
                artifacts/{`{project_id}`}/{`{run_id}`}/{selectedStage.artifact}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
