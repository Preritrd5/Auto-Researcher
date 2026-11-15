"use client";

import React from "react";
import Link from "next/link";
import { DollarSign, ShieldAlert, Check, Sparkles, ArrowRight, Lock, Zap, BookCheck } from "lucide-react";

import { useAuth } from "@/components/auth/auth-context";
import { Button } from "@/components/ui/button";

export function BenefitsSection() {
  const { isAuthenticated } = useAuth();

  return (
    <section id="benefits" className="border-t border-border/80 bg-surface/40 py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-4 md:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-accent">
            Platform Benefits
          </div>
          <h2 className="mt-4 font-serif text-3xl font-bold tracking-tight text-ink sm:text-4xl md:text-5xl">
            Why Operators Choose Auto-Researcher
          </h2>
          <p className="mt-4 text-base text-muted md:text-lg">
            Built from first principles for researchers who require durability, cost guarantees, and auditable outputs.
          </p>
        </div>

        <div className="mt-14 grid gap-8 md:grid-cols-3">
          {/* Card 1 */}
          <div className="glass-panel rounded-3xl border border-border/80 bg-white/70 p-8 shadow-sm">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-700">
              <DollarSign className="h-6 w-6" />
            </div>
            <h3 className="mt-5 font-serif text-xl font-bold text-ink">Hard Budget Ceilings</h3>
            <p className="mt-2 text-sm text-muted leading-relaxed">
              Never worry about unexpected runaway API bills. Every project enforces strict limits on USD cost, token quotas, and total runtime minutes.
            </p>
            <ul className="mt-5 space-y-2 text-xs text-muted">
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-success" />
                <span>Real-time expenditure tracking</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-success" />
                <span>Automatic shutdown when limit reached</span>
              </li>
            </ul>
          </div>

          {/* Card 2 */}
          <div className="glass-panel rounded-3xl border border-border/80 bg-white/70 p-8 shadow-sm">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10 text-accent">
              <Lock className="h-6 w-6" />
            </div>
            <h3 className="mt-5 font-serif text-xl font-bold text-ink">100% Self-Hosted Privacy</h3>
            <p className="mt-2 text-sm text-muted leading-relaxed">
              Your research ideas, unreleased code, proprietary datasets, and experiment logs remain entirely within your infrastructure.
            </p>
            <ul className="mt-5 space-y-2 text-xs text-muted">
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-success" />
                <span>No third-party SaaS vendor locks</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-success" />
                <span>Supports local Ollama / vLLM / CLI agents</span>
              </li>
            </ul>
          </div>

          {/* Card 3 */}
          <div className="glass-panel rounded-3xl border border-border/80 bg-white/70 p-8 shadow-sm">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-700">
              <BookCheck className="h-6 w-6" />
            </div>
            <h3 className="mt-5 font-serif text-xl font-bold text-ink">Durable Memory &amp; Citations</h3>
            <p className="mt-2 text-sm text-muted leading-relaxed">
              Context is never lost between pipeline steps. Project memories persist across runs, allowing incremental research refinement over weeks.
            </p>
            <ul className="mt-5 space-y-2 text-xs text-muted">
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-success" />
                <span>Cross-run knowledge graph retention</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-success" />
                <span>Live arXiv author and DOI verification</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Big Bottom CTA Banner */}
        <div className="glass-panel mt-16 rounded-[32px] border border-accent/30 bg-gradient-to-r from-accent/15 via-surface to-accent/10 p-8 md:p-12 shadow-glow">
          <div className="flex flex-col items-center justify-between gap-6 text-center md:flex-row md:text-left">
            <div>
              <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-accent">
                <Sparkles className="h-4 w-4" />
                Ready to Start?
              </div>
              <h3 className="mt-2 font-serif text-2xl font-bold text-ink md:text-3xl">
                Deploy your first autonomous research loop today.
              </h3>
              <p className="mt-1 text-sm text-muted">
                Zero telemetry leakage, fully open-source, and pre-configured for immediate local execution.
              </p>
            </div>
            <Link href={isAuthenticated ? "/dashboard" : "/signup"}>
              <Button className="flex items-center gap-2 px-8 py-4 text-sm font-semibold shadow-glow">
                {isAuthenticated ? "Go to Dashboard" : "Get Started Now"}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
