"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Eye,
  EyeOff,
  Lock,
  Mail,
  User as UserIcon,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Check,
  X
} from "lucide-react";

import { useAuth } from "@/components/auth/auth-context";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const EMAIL_REGEX = /^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$/;

export default function SignUpPage() {
  const { register, isAuthenticated } = useAuth();
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (isAuthenticated) {
    router.push("/dashboard");
    return null;
  }

  // Live password requirements
  const hasMinLength = password.length >= 8;
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasDigitOrSpecial = /[0-9!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password);
  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanName || cleanName.length < 2) {
      setError("Please enter your full name or researcher handle (at least 2 characters).");
      return;
    }
    if (!cleanEmail || !EMAIL_REGEX.test(cleanEmail)) {
      setError("Please enter a valid email address.");
      return;
    }
    if (!hasMinLength) {
      setError("Password must be at least 8 characters long.");
      return;
    }
    if (!hasLetter || !hasDigitOrSpecial) {
      setError("Password must contain both letters and at least one number or special character.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match. Please re-enter your password confirmation.");
      return;
    }

    try {
      setIsSubmitting(true);
      await register(cleanName, cleanEmail, password, confirmPassword);
      setSuccessMessage("Account created successfully! Preparing your research workspace...");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to create account. Please try again.";
      setError(msg);
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
            Create an Account
          </h1>
          <p className="mt-2 text-sm text-muted">
            Set up your operator identity to initialize projects, runs, and durable research memory.
          </p>
        </div>

        {/* Card Form */}
        <Card className="p-6 md:p-8">
          {successMessage ? (
            <div className="space-y-4 text-center py-6">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-success">
                <CheckCircle2 className="h-7 w-7" />
              </div>
              <h3 className="font-serif text-xl font-bold text-ink">Registration Confirmed</h3>
              <p className="text-xs text-muted leading-relaxed">{successMessage}</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
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
                  htmlFor="signup-name"
                  className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted"
                >
                  Full Name / Researcher Handle
                </label>
                <div className="relative">
                  <Input
                    id="signup-name"
                    type="text"
                    placeholder="Dr. Eleanor Vance"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="pl-10"
                  />
                  <UserIcon className="absolute left-3.5 top-3.5 h-4 w-4 text-muted/60" aria-hidden="true" />
                </div>
              </div>

              <div>
                <label
                  htmlFor="signup-email"
                  className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted"
                >
                  Email Address
                </label>
                <div className="relative">
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="eleanor@laboratory.org"
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
                <label
                  htmlFor="signup-password"
                  className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted"
                >
                  Password
                </label>
                <div className="relative">
                  <Input
                    id="signup-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="At least 8 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="new-password"
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

                {/* Password strength checklist */}
                {password.length > 0 ? (
                  <div className="mt-2 space-y-1 rounded-xl bg-white/50 p-2.5 text-[11px]">
                    <div className="flex items-center gap-1.5 text-muted">
                      {hasMinLength ? (
                        <Check className="h-3.5 w-3.5 text-success" />
                      ) : (
                        <X className="h-3.5 w-3.5 text-muted/50" />
                      )}
                      <span className={hasMinLength ? "text-success font-medium" : ""}>
                        Minimum 8 characters
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-muted">
                      {hasLetter && hasDigitOrSpecial ? (
                        <Check className="h-3.5 w-3.5 text-success" />
                      ) : (
                        <X className="h-3.5 w-3.5 text-muted/50" />
                      )}
                      <span className={hasLetter && hasDigitOrSpecial ? "text-success font-medium" : ""}>
                        Contains letters and numbers or symbols
                      </span>
                    </div>
                  </div>
                ) : null}
              </div>

              <div>
                <label
                  htmlFor="signup-confirm-password"
                  className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted"
                >
                  Confirm Password
                </label>
                <div className="relative">
                  <Input
                    id="signup-confirm-password"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Re-enter password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                    className="pl-10 pr-10"
                  />
                  <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-muted/60" aria-hidden="true" />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3.5 top-3.5 text-muted/60 transition hover:text-ink focus:outline-none"
                    aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {confirmPassword.length > 0 && !passwordsMatch ? (
                  <p className="mt-1 text-[11px] text-danger">Passwords do not match.</p>
                ) : null}
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  isLoading={isSubmitting}
                  className="w-full py-3.5 text-sm font-semibold shadow-glow"
                >
                  Create Account <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>
              </div>
            </form>
          )}

          {/* Privacy note */}
          <div className="mt-6 rounded-2xl border border-border/80 bg-surface/70 p-3.5 text-xs text-muted">
            <div className="font-semibold text-ink flex items-center gap-1.5 mb-1">
              <ShieldCheck className="h-3.5 w-3.5 text-accent" /> Operator Privacy
            </div>
            Credentials and research runs are stored in your local self-hosted database.
          </div>
        </Card>

        {/* Footer switch */}
        <p className="text-center text-xs text-muted">
          Already have an account?{" "}
          <Link href="/signin" className="font-semibold text-accent hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
