"use client";

import React from "react";
import { Cpu, ShieldCheck, Database, RadioTower, RefreshCw, Terminal, Layers, Scale } from "lucide-react";
import { Card } from "@/components/ui/card";

const FEATURES = [
  {
    icon: Database,
    title: "Durable DB State Machine",
    description: "Built on database leases, heartbeats, and stage checkpoints. Long-running research loops resume safely even if the machine restarts."
  },
  {
    icon: Cpu,
    title: "Pluggable Model Gateway",
    description: "Support for OpenAI-compatible gateways (DeepSeek, Qwen, OpenRouter), native Anthropic API, native OpenAI, or local CLI agents."
  },
  {
    icon: Scale,
    title: "Adversarial Critic Architecture",
    description: "Assign different model families to generation and critique to prevent echo-chamber hallucination and validate experimental rigor."
  },
  {
    icon: ShieldCheck,
    title: "Anti-Hallucination Citations",
    description: "Literature scan queries arXiv and Crossref, scoring title similarity with SequenceMatcher to ensure 0% hallucinated references."
  },
  {
    icon: Terminal,
    title: "Flexible Compute Targets",
    description: "Run code on your local GPU, isolated Docker containers, or high-performance remote SSH clusters with automated environment setup."
  },
  {
    icon: RefreshCw,
    title: "Self-Healing Code Repair",
    description: "When code execution fails, the recovery manager classifies error classes (Tooling, Code, Data, Resource) and self-patches scripts up to 3 times."
  },
  {
    icon: RadioTower,
    title: "Real-Time WebSocket Feeds",
    description: "Stream stage events, task status transitions, and raw terminal stdout/stderr logs live to your browser dashboard."
  },
  {
    icon: Layers,
    title: "Artifact-First Auditing",
    description: "Every stage writes verifiable Markdown, JSON, YAML, and LaTeX files directly to disk with cryptographic checksums recorded in the DB."
  }
];

export function FeaturesSection() {
  return (
    <section id="features" className="py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-4 md:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-accent">
            Key Features · Core Architecture
          </div>
          <h2 className="mt-4 font-serif text-3xl font-bold tracking-tight text-ink sm:text-4xl md:text-5xl">
            Engineered for Resilient Research
          </h2>
          <p className="mt-4 text-base text-muted md:text-lg">
            Unlike ephemeral chat windows, Auto-Researcher treats scientific research as an autonomous, verifiable engineering loop.
          </p>
        </div>

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((feat, idx) => {
            const Icon = feat.icon;
            return (
              <Card key={idx} className="flex flex-col justify-between p-6 transition hover:shadow-glow">
                <div>
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent/10 text-accent">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 font-serif text-lg font-bold text-ink">
                    {feat.title}
                  </h3>
                  <p className="mt-2 text-xs leading-relaxed text-muted">
                    {feat.description}
                  </p>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}
