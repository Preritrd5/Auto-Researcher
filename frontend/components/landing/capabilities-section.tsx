"use client";

import React from "react";
import {
  Code2,
  Scale,
  Search,
  Server,
  CheckCircle2,
  ArrowRight,
  ShieldAlert,
  Zap,
  Terminal,
  FileCheck
} from "lucide-react";
import Link from "next/link";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const CAPABILITIES = [
  {
    icon: Code2,
    badge: "Self-Healing Runtimes",
    title: "Autonomous Code Generation & Execution",
    description:
      "Generates production-grade PyTorch experiment scripts with seed configs, metric collection hooks, and artifact writers. If an execution fails, the built-in recovery engine inspects stack traces and automatically patches syntax, environment, or data issues.",
    features: [
      "Zero-shot script synthesis tailored to hardware targets",
      "Automated trace classification (Tooling, Syntax, OOM, Data)",
      "Multi-attempt self-patching loop with lease preservation",
      "Full workspace snapshot archiving with checksums"
    ],
    codeSnippet: `# Auto-Researcher runtime hook
def execute_stage_loop(trial: ExperimentTrial):
    env = configure_compute_target("local-gpu-0")
    for attempt in range(MAX_RETRIES):
        result = env.run_script("train.py", seed=42)
        if result.exit_code == 0:
            return record_metrics(result.stdout)
        patch_code_with_critic(trial, result.stderr)`
  },
  {
    icon: Scale,
    badge: "Dual-Model Architecture",
    title: "Adversarial Generation & Critique",
    description:
      "Prevents confirmation bias and echo-chamber reasoning by pairing distinct model families. The primary model explores novel technical architectures while an independent critic model rigorously evaluates feasibility, novelty against SOTA, and experimental validity.",
    features: [
      "Decoupled primary generator and adversarial critic models",
      "Quantitative scoring rubric for novelty and feasibility",
      "Automated hypothesis ranking before costly compute allocation",
      "Support for mixing Anthropic Claude, OpenAI GPT, and DeepSeek"
    ],
    codeSnippet: `// Adversarial Ranking Rubric
const rubric = {
  novelty: evaluateMethodologicalDivergence(priorWork),
  feasibility: computeComplexityBounds(dataset, budget),
  soundness: checkHypothesisFalsifiability(brief)
};
const rank = await criticModel.score(candidates, rubric);`
  },
  {
    icon: Search,
    badge: "Zero-Hallucination Retrieval",
    title: "Live Academic Literature Scanning",
    description:
      "Directly queries live academic repositories including arXiv and Crossref. Every cited paper is validated for genuine existence, correct author lists, publication years, and valid DOIs—guaranteeing 0% hallucinated references in generated proposals and papers.",
    features: [
      "Integrated arXiv API and Crossref DOI resolution",
      "SequenceMatcher title similarity threshold verification",
      "Automated bibliography generation in BibTeX & Markdown",
      "Deduplication and citation relationship tracking"
    ],
    codeSnippet: `GET /api/literature/scan?query=low-latency+audio+transformers
Response: {
  "source": "arxiv",
  "arxiv_id": "2401.08253",
  "title": "Streaming Audio Transformers via Chunked State",
  "doi_verified": true,
  "confidence_score": 0.982
}`
  },
  {
    icon: Server,
    badge: "Hardware Agnostic",
    title: "Universal Compute Target Abstraction",
    description:
      "Run experiments wherever your compute resources live. Easily switch between local workstation GPUs, isolated sandboxed Docker containers, or high-performance remote SSH clusters without altering experiment scripts.",
    features: [
      "Local machine execution with virtual environment isolation",
      "Docker container runtimes for guaranteed reproducibility",
      "Remote SSH node execution with automated file sync",
      "Runtime priority scheduling and node health checks"
    ],
    codeSnippet: `compute_targets:
  - name: "workstation-rtx4090"
    kind: "local"
    priority: 1
  - name: "slurm-cluster-node"
    kind: "ssh"
    host: "cluster.lab.edu"
    workdir: "/scratch/research"`
  }
];

export function CapabilitiesSection() {
  return (
    <section id="capabilities" className="border-t border-border/80 bg-surface/30 py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-4 md:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-accent">
            Research Capabilities
          </div>
          <h2 className="mt-4 font-serif text-3xl font-bold tracking-tight text-ink sm:text-4xl md:text-5xl">
            Deep Scientific Automation Across Every Layer
          </h2>
          <p className="mt-4 text-base text-muted md:text-lg">
            Auto-Researcher combines state-of-the-art LLM orchestration with robust engineering primitives designed specifically for autonomous discovery.
          </p>
        </div>

        <div className="mt-16 space-y-12">
          {CAPABILITIES.map((cap, idx) => {
            const Icon = cap.icon;
            const isEven = idx % 2 === 0;
            return (
              <div
                key={idx}
                className="glass-panel grid items-center gap-8 rounded-[32px] border border-border/80 bg-surface/80 p-8 shadow-panel lg:grid-cols-12 lg:p-12"
              >
                {/* Text Content */}
                <div className={`space-y-4 lg:col-span-7 ${isEven ? "" : "lg:order-2"}`}>
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-white shadow-glow">
                      <Icon className="h-5 w-5" />
                    </div>
                    <Badge label={cap.badge} tone="accent" />
                  </div>

                  <h3 className="font-serif text-2xl font-bold tracking-tight text-ink sm:text-3xl">
                    {cap.title}
                  </h3>

                  <p className="text-sm leading-relaxed text-muted md:text-base">
                    {cap.description}
                  </p>

                  <div className="grid gap-2.5 pt-2 sm:grid-cols-2">
                    {cap.features.map((feature, fIdx) => (
                      <div key={fIdx} className="flex items-start gap-2 text-xs text-ink/90">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                        <span>{feature}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Code / Visual Window */}
                <div className={`lg:col-span-5 ${isEven ? "" : "lg:order-1"}`}>
                  <div className="overflow-hidden rounded-2xl border border-ink/20 bg-[#162320] shadow-panel">
                    <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-full bg-rose-500/80" />
                        <span className="h-2.5 w-2.5 rounded-full bg-amber-500/80" />
                        <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
                      </div>
                      <span className="font-mono text-[11px] text-white/50">capability-spec.py</span>
                    </div>
                    <pre className="overflow-x-auto p-4 font-mono text-xs leading-relaxed text-emerald-200/90">
                      <code>{cap.codeSnippet}</code>
                    </pre>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
