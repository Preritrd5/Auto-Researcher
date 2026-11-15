"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight, Play, CheckCircle2, Cpu, ShieldCheck, Database, FileText, Activity } from "lucide-react";

import { useAuth } from "@/components/auth/auth-context";
import { Button } from "@/components/ui/button";

export function HeroSection() {
  const { isAuthenticated } = useAuth();

  return (
    <section className="relative overflow-hidden pt-12 pb-20 md:pt-20 md:pb-28">
      <div className="mx-auto max-w-7xl px-4 md:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-12">
          {/* Left Column: Copy & Actions */}
          <div className="lg:col-span-7">
            <div className="inline-flex items-center gap-2 rounded-full border border-accent/25 bg-accent/10 px-3.5 py-1.5 text-xs font-semibold tracking-wide text-accent">
              <span className="flex h-2 w-2 rounded-full bg-accent animate-pulse" />
              Autonomous Scientific Discovery Platform
            </div>

            <h1 className="mt-6 font-serif text-4xl font-extrabold tracking-tight text-ink sm:text-5xl lg:text-6xl lg:leading-[1.12]">
              From research brief to published paper.{" "}
              <span className="text-accent underline decoration-accent/30 underline-offset-8">
                Autonomously.
              </span>
            </h1>

            <p className="mt-6 max-w-2xl text-base leading-relaxed text-muted sm:text-lg">
              Auto-Researcher orchestrates long-running ML/AI research loops with durable database checkpoints, multi-model critique, literature scanning via arXiv &amp; Crossref, automated code generation, and verifiable self-healing experiment runs.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3.5">
              <Link href={isAuthenticated ? "/dashboard" : "/signup"}>
                <Button size="lg" className="flex items-center gap-2 px-7 py-3.5 text-sm font-semibold shadow-glow">
                  {isAuthenticated ? "Open Dashboard" : "Get Started"}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              {!isAuthenticated ? (
                <Link href="/signin">
                  <Button variant="outline" size="lg" className="px-6 py-3.5 text-sm font-semibold">
                    Sign In
                  </Button>
                </Link>
              ) : null}
              <a href="#pipeline">
                <Button variant="secondary" size="lg" className="flex items-center gap-2 px-6 py-3.5 text-sm font-semibold">
                  <Play className="h-4 w-4 text-accent fill-accent/20" />
                  How It Works
                </Button>
              </a>
            </div>

            {/* Highlights pill tags */}
            <div className="mt-12 grid grid-cols-2 gap-4 border-t border-border/80 pt-8 sm:grid-cols-4">
              <div>
                <div className="font-serif text-2xl font-bold text-ink">10 Stages</div>
                <div className="mt-1 text-xs text-muted">Brief to LaTeX Export</div>
              </div>
              <div>
                <div className="font-serif text-2xl font-bold text-ink">Multi-Model</div>
                <div className="mt-1 text-xs text-muted">Claude · GPT · DeepSeek</div>
              </div>
              <div>
                <div className="font-serif text-2xl font-bold text-ink">Zero Hallucination</div>
                <div className="mt-1 text-xs text-muted">Verified arXiv &amp; DOI</div>
              </div>
              <div>
                <div className="font-serif text-2xl font-bold text-ink">Self-Hosted</div>
                <div className="mt-1 text-xs text-muted">Local, Docker &amp; SSH</div>
              </div>
            </div>
          </div>

          {/* Right Column: Hero Visual Card */}
          <div className="lg:col-span-5">
            <div className="glass-panel relative rounded-[32px] border border-border/90 bg-surface/95 p-6 shadow-panel">
              {/* Header bar */}
              <div className="flex items-center justify-between border-b border-border/80 pb-4">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-rose-400" />
                  <span className="h-3 w-3 rounded-full bg-amber-400" />
                  <span className="h-3 w-3 rounded-full bg-emerald-400" />
                  <span className="ml-2 font-mono text-xs font-semibold text-muted">pipeline: run-84a1f</span>
                </div>
                <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-semibold text-success">
                  Active Loop
                </span>
              </div>

              {/* Research brief preview */}
              <div className="mt-4 rounded-2xl bg-white/70 p-4 border border-border/60">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-accent">Active Project Brief</div>
                <div className="mt-1 font-serif text-sm font-semibold text-ink">
                  Contrastive Pretraining for Ultra-Low-Latency Audio Transformers
                </div>
                <p className="mt-1 text-xs text-muted leading-relaxed">
                  Evaluating streaming latency trade-offs vs frame-level recall on benchmark datasets.
                </p>
              </div>

              {/* Pipeline progress simulation */}
              <div className="mt-4 space-y-2.5">
                <div className="flex items-center justify-between rounded-xl bg-emerald-50/80 p-3 border border-emerald-200/60">
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="h-4 w-4 text-success" />
                    <div>
                      <div className="text-xs font-semibold text-ink">Stage 2: Literature Scan</div>
                      <div className="text-[10px] text-muted">Crossref &amp; arXiv: 14 papers retrieved &amp; verified</div>
                    </div>
                  </div>
                  <span className="font-mono text-[10px] font-semibold text-success">100%</span>
                </div>

                <div className="flex items-center justify-between rounded-xl bg-emerald-50/80 p-3 border border-emerald-200/60">
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="h-4 w-4 text-success" />
                    <div>
                      <div className="text-xs font-semibold text-ink">Stage 5: Proposal Drafting</div>
                      <div className="text-[10px] text-muted">Multi-model critique passed (novelty: 0.88)</div>
                    </div>
                  </div>
                  <span className="font-mono text-[10px] font-semibold text-success">100%</span>
                </div>

                <div className="flex items-center justify-between rounded-xl bg-accent/10 p-3 border border-accent/30 animate-pulse">
                  <div className="flex items-center gap-2.5">
                    <Activity className="h-4 w-4 text-accent" />
                    <div>
                      <div className="text-xs font-semibold text-ink">Stage 8: Experiment &amp; Refine Loop</div>
                      <div className="text-[10px] text-muted">Local PyTorch worker training epoch 12/20...</div>
                    </div>
                  </div>
                  <span className="font-mono text-[10px] font-bold text-accent">RUNNING</span>
                </div>

                <div className="flex items-center justify-between rounded-xl bg-surface p-3 border border-border/60 opacity-60">
                  <div className="flex items-center gap-2.5">
                    <FileText className="h-4 w-4 text-muted" />
                    <div>
                      <div className="text-xs font-semibold text-ink">Stage 10: Paper Drafting &amp; Export</div>
                      <div className="text-[10px] text-muted">LaTeX synthesis pending experiment completion</div>
                    </div>
                  </div>
                  <span className="font-mono text-[10px] text-muted">QUEUED</span>
                </div>
              </div>

              {/* Telemetry bottom */}
              <div className="mt-4 flex items-center justify-between border-t border-border/80 pt-3 text-[11px] text-muted">
                <span>Compute: local-default (RTX 4090)</span>
                <span>Token Spend: $2.42 / $50.00</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
