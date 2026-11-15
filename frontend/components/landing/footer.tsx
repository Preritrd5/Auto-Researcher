"use client";

import React from "react";
import Link from "next/link";
import { Sparkles, Github, BookOpen, Shield, Code, Heart } from "lucide-react";

export function LandingFooter() {
  return (
    <footer className="border-t border-border/80 bg-surface/90 py-12 text-sm text-muted">
      <div className="mx-auto max-w-7xl px-4 md:px-8">
        <div className="grid gap-10 md:grid-cols-4">
          {/* Brand Info */}
          <div className="space-y-4 md:col-span-2">
            <Link href="/" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent text-white">
                <Sparkles className="h-4 w-4" />
              </div>
              <span className="font-serif text-lg font-bold text-ink">Auto-Researcher</span>
            </Link>
            <p className="max-w-md text-xs leading-relaxed text-muted">
              A single-user, self-hosted ML/AI automated research platform that turns research briefs into hypotheses, experiments, results, and publication-ready papers.
            </p>
            <div className="pt-2 text-xs text-muted/80">
              Licensed under MIT · Single-user self-hosted runtime
            </div>
          </div>

          {/* Architecture Links */}
          <div className="space-y-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-ink">
              Platform
            </div>
            <ul className="space-y-2 text-xs">
              <li>
                <a href="#how-it-works" className="hover:text-ink transition">How It Works</a>
              </li>
              <li>
                <a href="#features" className="hover:text-ink transition">Key Features</a>
              </li>
              <li>
                <a href="#capabilities" className="hover:text-ink transition">Capabilities</a>
              </li>
              <li>
                <a href="#benefits" className="hover:text-ink transition">Benefits</a>
              </li>
              <li>
                <a href="http://127.0.0.1:8000/docs" target="_blank" rel="noopener noreferrer" className="hover:text-ink transition">
                  FastAPI Swagger Docs
                </a>
              </li>
            </ul>
          </div>

          {/* Community Links */}
          <div className="space-y-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-ink">
              Links &amp; Source
            </div>
            <ul className="space-y-2 text-xs">
              <li>
                <a
                  href="https://github.com/Preritrd5/Auto-Researcher"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 hover:text-ink transition"
                >
                  <Github className="h-3.5 w-3.5" /> GitHub Repository
                </a>
              </li>
              <li>
                <Link href="/signin" className="hover:text-ink transition">
                  Operator Sign In
                </Link>
              </li>
              <li>
                <Link href="/signup" className="hover:text-ink transition">
                  Register Account
                </Link>
              </li>
              <li>
                <Link href="/dashboard" className="hover:text-ink transition">
                  Dashboard
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-border/80 pt-8 text-xs text-muted/70 md:flex-row">
          <div>
            &copy; {new Date().getFullYear()} Auto-Researcher. All rights reserved.
          </div>
          <div className="flex items-center gap-1">
            Engineered for durable autonomous discovery.
          </div>
        </div>
      </div>
    </footer>
  );
}
