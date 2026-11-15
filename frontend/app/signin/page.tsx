"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Eye,
  EyeOff,
  Lock,
  Mail,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  AlertCircle,
  X,
  Info
} from "lucide-react";

import { useAuth } from "@/components/auth/auth-context";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const EMAIL_REGEX = /^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$/;

export default function SignInPage() {
  const { login, isAuthenticated } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);

  // If already authenticated, redirect to dashboard
  if (isAuthenticated) {
    router.push("/dashboard");
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !EMAIL_REGEX.test(cleanEmail)) {
      setError("Please enter a valid email address (e.g., name@laboratory.org).");
      return;
    }
    if (!password) {
      setError("Please enter your password.");
      return;
    }

    try {
      setIsSubmitting(true);
      await login(cleanEmail, password, rememberMe);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to sign in. Please verify your credentials.";
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-80px)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.25em] text-accent transition hover:opacity-80"
          >
            <Sparkles className="h-4 w-4" />
            Auto-Researcher
          </Link>
          <h1 className="mt-3 font-serif text-3xl font-bold tracking-tight text-ink md:text-4xl">
            Welcome Back
          </h1>
          <p className="mt-2 text-sm text-muted">
            Sign in to access your autonomous research loops, projects, and pipeline telemetry.
          </p>
        </div>

        {/* Card Form */}
        <Card className="p-6 md:p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error ? (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-2xl border border-danger/30 bg-danger/10 p-3.5 text-xs font-medium text-danger"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            ) : null}

            <div>
              <label
                htmlFor="signin-email"
                className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted"
              >
                Email Address
              </label>
              <div className="relative">
                <Input
                  id="signin-email"
                  type="email"
                  placeholder="operator@laboratory.org"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="pl-10"
                />
                <Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-muted/60" aria-hidden="true" />
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <label
                  htmlFor="signin-password"
                  className="text-xs font-semibold uppercase tracking-wider text-muted"
                >
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => setShowForgotModal(true)}
                  className="text-xs text-accent transition hover:underline focus:outline-none"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Input
                  id="signin-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="pl-10 pr-10"
                />
                <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-muted/60" aria-hidden="true" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-3.5 text-muted/60 transition hover:text-ink focus:outline-none"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Remember Me Checkbox */}
            <div className="flex items-center gap-2">
              <input
                id="remember-me"
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-4 w-4 rounded border-border text-accent focus:ring-accent"
              />
              <label htmlFor="remember-me" className="text-xs text-muted cursor-pointer select-none">
                Remember this workstation (30-day session)
              </label>
            </div>

            <Button
              type="submit"
              isLoading={isSubmitting}
              className="w-full py-3.5 text-sm font-semibold shadow-glow"
            >
              Sign In <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
          </form>

          {/* Self-hosted security badge */}
          <div className="mt-6 rounded-2xl border border-border/80 bg-surface/70 p-3.5 text-xs text-muted">
            <div className="font-semibold text-ink flex items-center gap-1.5 mb-1">
              <ShieldCheck className="h-3.5 w-3.5 text-accent" /> Secure Authentication
            </div>
            Protected by HttpOnly SameSite cookies, bcrypt salted password hashing, and brute-force rate limiting.
          </div>
        </Card>

        {/* Footer switch */}
        <p className="text-center text-xs text-muted">
          Don&apos;t have an account yet?{" "}
          <Link href="/signup" className="font-semibold text-accent hover:underline">
            Create an account
          </Link>
        </p>
      </div>

      {/* Forgot Password Status Dialog */}
      {showForgotModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-md rounded-[28px] border border-border bg-surface p-6 shadow-panel">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2 text-ink font-serif text-lg font-bold">
                <Info className="h-5 w-5 text-accent" />
                Password Reset Notice
              </div>
              <button
                onClick={() => setShowForgotModal(false)}
                className="rounded-lg p-1 text-muted hover:bg-white/60 hover:text-ink"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs leading-relaxed text-muted">
              <p>
                <strong className="text-ink">Email delivery (SMTP) is not configured</strong> in this environment. In self-hosted mode, automated password reset emails are disabled by design to prevent telemetry leakage.
              </p>
              <div className="rounded-xl border border-border bg-white/70 p-3 font-mono text-[11px] text-ink">
                # Reset password directly via backend CLI:
                <br />
                cd backend &amp;&amp; uv run python -c &quot;from app.core.security import hash_password; print(hash_password(&apos;new_pass&apos;))&quot;
              </div>
              <p>
                Alternatively, you can register a new researcher handle on the sign-up page.
              </p>
            </div>

            <div className="mt-6 flex justify-end">
              <Button onClick={() => setShowForgotModal(false)} size="sm">
                Understood
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
