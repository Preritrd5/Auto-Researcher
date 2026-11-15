"use client";

import React, { useEffect, useState } from "react";
import {
  User as UserIcon,
  Shield,
  Cpu,
  Server,
  CheckCircle2,
  Activity,
  LogOut,
  Edit2,
  Check,
  AlertCircle,
  Database,
  Radio
} from "lucide-react";

import { useAuth } from "@/components/auth/auth-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { api } from "@/lib/api";
import { ComputeTarget, ModelProfile } from "@/lib/types";

export default function SettingsPage() {
  const { user, logout, refreshUser } = useAuth();
  const [profiles, setProfiles] = useState<ModelProfile[]>([]);
  const [targets, setTargets] = useState<ComputeTarget[]>([]);
  const [health, setHealth] = useState<string>("Checking...");

  // Edit Name state
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [nameMessage, setNameMessage] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);

  useEffect(() => {
    if (user?.name) {
      setNameInput(user.name);
    }
  }, [user]);

  useEffect(() => {
    async function loadConfig() {
      try {
        const [nextProfiles, nextTargets] = await Promise.all([
          api.listProfiles(),
          api.listComputeTargets()
        ]);
        setProfiles(nextProfiles);
        setTargets(nextTargets);
        setHealth("Healthy (HTTP 200)");
      } catch (err) {
        console.error("Settings load error:", err);
        setHealth("Degraded / Offline");
      }
    }

    void loadConfig();
  }, []);

  async function handleSaveName(e: React.FormEvent) {
    e.preventDefault();
    setNameError(null);
    setNameMessage(null);
    const clean = nameInput.trim();
    if (!clean || clean.length < 2) {
      setNameError("Name must be at least 2 characters long.");
      return;
    }

    try {
      setSavingName(true);
      await api.updateProfile({ name: clean });
      await refreshUser();
      setNameMessage("Profile handle updated successfully.");
      setIsEditingName(false);
    } catch (err) {
      setNameError(err instanceof Error ? err.message : "Failed to update profile name.");
    } finally {
      setSavingName(false);
    }
  }

  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString(undefined, {
        month: "long",
        day: "numeric",
        year: "numeric"
      })
    : "Active Session";

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <h1 className="font-serif text-3xl font-bold tracking-tight text-ink md:text-4xl">
          Operator Settings &amp; Configuration
        </h1>
        <p className="mt-1 text-sm text-muted">
          Manage your researcher profile, review active LLM model gateways, and monitor execution node health.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* ===================== OPERATOR PROFILE ===================== */}
        <Card className="p-6">
          <CardTitle
            eyebrow="Identity"
            title="Operator Profile"
            description="Your authenticated self-hosted researcher session and account info."
          />
          <div className="space-y-4">
            <div className="flex items-center gap-3.5 rounded-2xl bg-white/70 p-4 border border-border/70">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent/15 font-serif text-lg font-bold text-accent">
                {user?.name ? user.name[0].toUpperCase() : "U"}
              </div>
              <div className="flex-1 overflow-hidden">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-ink text-sm truncate">{user?.name}</div>
                  {!isEditingName ? (
                    <button
                      onClick={() => setIsEditingName(true)}
                      className="text-[11px] font-medium text-accent hover:underline flex items-center gap-1"
                    >
                      <Edit2 className="h-3 w-3" /> Edit
                    </button>
                  ) : null}
                </div>
                <div className="text-xs text-muted truncate">{user?.email}</div>
                <div className="mt-1.5 flex items-center gap-2">
                  <Badge label={user?.role || "researcher"} tone="active" />
                  <span className="font-mono text-[10px] text-muted">
                    ID: {user?.id ? user.id.slice(0, 10) + "..." : ""}
                  </span>
                </div>
              </div>
            </div>

            {/* Inline Name Editor */}
            {isEditingName ? (
              <form onSubmit={handleSaveName} className="rounded-2xl border border-accent/30 bg-white/80 p-4 space-y-3">
                <Label htmlFor="operator-name">Update Full Name / Handle</Label>
                <Input
                  id="operator-name"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  required
                  className="text-xs py-2"
                />
                {nameError ? <p className="text-xs text-danger">{nameError}</p> : null}
                <div className="flex items-center justify-end gap-2 pt-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setIsEditingName(false);
                      setNameInput(user?.name || "");
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" size="sm" isLoading={savingName}>
                    Save Handle
                  </Button>
                </div>
              </form>
            ) : null}

            {nameMessage ? (
              <div className="flex items-center gap-2 rounded-xl bg-emerald-50 p-2.5 text-xs text-success border border-emerald-200">
                <Check className="h-4 w-4" />
                <span>{nameMessage}</span>
              </div>
            ) : null}

            {/* Account Details list */}
            <div className="space-y-2.5 text-xs pt-2 border-t border-border/60">
              <div className="flex items-center justify-between text-muted">
                <span>Account Role:</span>
                <span className="font-semibold text-ink capitalize">{user?.role || "Researcher"}</span>
              </div>
              <div className="flex items-center justify-between text-muted">
                <span>Member Since:</span>
                <span className="font-semibold text-ink">{memberSince}</span>
              </div>
              <div className="flex items-center justify-between text-muted">
                <span>Session Persistence:</span>
                <span className="font-semibold text-success flex items-center gap-1">
                  <Shield className="h-3.5 w-3.5" /> HttpOnly Secure Cookie
                </span>
              </div>
            </div>

            <div className="pt-3 border-t border-border/70 flex justify-between items-center">
              <span className="text-[11px] text-muted">Sign out to end local session</span>
              <Button variant="danger" size="sm" onClick={logout} className="flex items-center gap-1.5 text-xs">
                <LogOut className="h-3.5 w-3.5" />
                Sign Out
              </Button>
            </div>
          </div>
        </Card>

        {/* ===================== SYSTEM & INFRASTRUCTURE HEALTH ===================== */}
        <Card className="p-6">
          <CardTitle
            eyebrow="Infrastructure"
            title="Service Diagnostics"
            description="Runtime connectivity and system health telemetry."
          />
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-xl bg-white/60 p-3.5 border border-border/70 text-xs">
              <span className="text-muted flex items-center gap-1.5">
                <Activity className="h-4 w-4 text-accent" /> FastAPI Backend:
              </span>
              <span className="font-semibold text-success flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4" />
                {health}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-white/60 p-3.5 border border-border/70 text-xs">
              <span className="text-muted flex items-center gap-1.5">
                <Database className="h-4 w-4 text-purple-600" /> Database Engine:
              </span>
              <span className="font-semibold text-ink">SQLite (aiosqlite) / PostgreSQL</span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-white/60 p-3.5 border border-border/70 text-xs">
              <span className="text-muted flex items-center gap-1.5">
                <Radio className="h-4 w-4 text-blue-600" /> WebSocket Event Stream:
              </span>
              <span className="font-semibold text-ink">/api/ws/events</span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-white/60 p-3.5 border border-border/70 text-xs">
              <span className="text-muted flex items-center gap-1.5">
                <Cpu className="h-4 w-4 text-amber-600" /> Registered Model Gateways:
              </span>
              <span className="font-semibold text-ink">{profiles.length} profile(s)</span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-white/60 p-3.5 border border-border/70 text-xs">
              <span className="text-muted flex items-center gap-1.5">
                <Server className="h-4 w-4 text-emerald-600" /> Execution Compute Nodes:
              </span>
              <span className="font-semibold text-ink">{targets.length} target(s)</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Model Profiles & Compute Runtimes Overview */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="p-6">
          <CardTitle
            eyebrow="Model Routing"
            title="Connected LLM Gateways"
            description="Configured provider profiles for generation and adversarial critique."
          />
          {profiles.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted">
              No custom model profiles configured yet. Default provider gateway active.
            </div>
          ) : (
            <div className="space-y-2.5">
              {profiles.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between rounded-xl bg-white/60 p-3 border border-border/60 text-xs"
                >
                  <div>
                    <div className="font-semibold text-ink">{p.name}</div>
                    <div className="text-[10px] text-muted font-mono">{p.model_name} ({p.provider_kind})</div>
                  </div>
                  <Badge label={p.active ? "Active" : "Inactive"} tone={p.active ? "success" : "queued"} />
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-6">
          <CardTitle
            eyebrow="Compute Fleet"
            title="Execution Compute Targets"
            description="Available hardware execution nodes (local, docker, ssh)."
          />
          {targets.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted">
              No compute targets detected.
            </div>
          ) : (
            <div className="space-y-2.5">
              {targets.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between rounded-xl bg-white/60 p-3 border border-border/60 text-xs"
                >
                  <div>
                    <div className="font-semibold text-ink">{c.name}</div>
                    <div className="text-[10px] text-muted font-mono">Kind: {c.kind} · Priority: {c.priority}</div>
                  </div>
                  <Badge label="Available" tone="success" />
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
