"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Sparkles, ArrowRight, Menu, X, LayoutDashboard, LogIn, ExternalLink } from "lucide-react";

import { useAuth } from "@/components/auth/auth-context";
import { Button } from "@/components/ui/button";

export function LandingNavbar() {
  const { isAuthenticated, user } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/80 bg-surface/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 md:px-8">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-white shadow-glow">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <span className="font-serif text-xl font-bold tracking-tight text-ink">Auto-Researcher</span>
            <span className="ml-2 rounded-full border border-accent/20 bg-accent/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent">
              v1.0
            </span>
          </div>
        </Link>

        {/* Desktop Nav Links */}
        <nav className="hidden items-center gap-7 md:flex">
          <a href="#how-it-works" className="text-sm font-medium text-muted transition hover:text-ink">
            How It Works
          </a>
          <a href="#features" className="text-sm font-medium text-muted transition hover:text-ink">
            Features
          </a>
          <a href="#capabilities" className="text-sm font-medium text-muted transition hover:text-ink">
            Capabilities
          </a>
          <a href="#benefits" className="text-sm font-medium text-muted transition hover:text-ink">
            Benefits
          </a>
        </nav>

        {/* CTA Buttons */}
        <div className="hidden items-center gap-3 md:flex">
          {isAuthenticated ? (
            <Link href="/dashboard">
              <Button className="flex items-center gap-2 px-5 py-2.5 text-xs font-semibold uppercase tracking-wider shadow-glow">
                <LayoutDashboard className="h-4 w-4" />
                Dashboard ({user?.name.split(" ")[0]})
              </Button>
            </Link>
          ) : (
            <>
              <Link href="/signin">
                <Button variant="ghost" className="text-xs font-semibold uppercase tracking-wider text-ink hover:bg-white/80">
                  Sign In
                </Button>
              </Link>
              <Link href="/signup">
                <Button className="flex items-center gap-1.5 px-5 py-2.5 text-xs font-semibold uppercase tracking-wider shadow-glow">
                  Get Started <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </>
          )}
        </div>

        {/* Mobile menu trigger */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="rounded-xl p-2 text-ink md:hidden hover:bg-white/60"
          aria-label="Toggle Navigation Menu"
        >
          {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen ? (
        <div className="border-b border-border bg-surface px-6 py-6 md:hidden">
          <nav className="flex flex-col gap-4">
            <a
              href="#how-it-works"
              onClick={() => setMobileMenuOpen(false)}
              className="text-base font-medium text-muted hover:text-ink"
            >
              How It Works
            </a>
            <a
              href="#features"
              onClick={() => setMobileMenuOpen(false)}
              className="text-base font-medium text-muted hover:text-ink"
            >
              Features
            </a>
            <a
              href="#capabilities"
              onClick={() => setMobileMenuOpen(false)}
              className="text-base font-medium text-muted hover:text-ink"
            >
              Capabilities
            </a>
            <a
              href="#benefits"
              onClick={() => setMobileMenuOpen(false)}
              className="text-base font-medium text-muted hover:text-ink"
            >
              Benefits
            </a>
            <div className="mt-4 flex flex-col gap-2 pt-4 border-t border-border">
              {isAuthenticated ? (
                <Link href="/dashboard" onClick={() => setMobileMenuOpen(false)}>
                  <Button className="w-full">Dashboard</Button>
                </Link>
              ) : (
                <>
                  <Link href="/signin" onClick={() => setMobileMenuOpen(false)}>
                    <Button variant="secondary" className="w-full">
                      Sign In
                    </Button>
                  </Link>
                  <Link href="/signup" onClick={() => setMobileMenuOpen(false)}>
                    <Button className="w-full">Get Started</Button>
                  </Link>
                </>
              )}
            </div>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
