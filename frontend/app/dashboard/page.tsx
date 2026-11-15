"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  FolderKanban,
  Activity,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  Plus,
  Clock,
  DollarSign,
  TrendingUp,
  Search,
  Filter,
  ArrowUpDown,
  ExternalLink,
  Layers,
  AlertCircle,
  FileText,
  Calendar
} from "lucide-react";

import { useAuth } from "@/components/auth/auth-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { NewProjectDialog } from "@/components/dashboard/new-project-dialog";
import { api } from "@/lib/api";
import { Project, Run } from "@/lib/types";
import { currency } from "@/lib/utils";

export default function DashboardOverviewPage() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters for recent projects
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"newest" | "oldest">("newest");
  const [newProjectOpen, setNewProjectOpen] = useState(false);

  async function loadData() {
    try {
      setLoading(true);
      const [nextProjects, nextRuns] = await Promise.all([
        api.listProjects(),
        api.listRuns()
      ]);
      setProjects(nextProjects);
      setRuns(nextRuns);
      setError(null);
    } catch (err) {
      console.error("Dashboard overview load error:", err);
      setError(err instanceof Error ? err.message : "Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  // 1. Total Research Projects
  const totalProjects = projects.length;
  // 2. Active Research Projects
  const activeProjects = projects.filter(
    (p) => !p.status || p.status.toLowerCase() === "active"
  ).length;
  // 3. Completed Research Projects
  const completedProjects = projects.filter(
    (p) => p.status && p.status.toLowerCase() === "completed"
  ).length;
  // 4. Total Experiment Runs
  const totalRuns = runs.length;

  // Runs per project lookup
  const runsCountMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const r of runs) {
      map[r.project_id] = (map[r.project_id] || 0) + 1;
    }
    return map;
  }, [runs]);

  // Filtered and sorted recent projects (showing up to 6)
  const recentProjects = useMemo(() => {
    let result = [...projects];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.description && p.description.toLowerCase().includes(q)) ||
          (p.objective && p.objective.toLowerCase().includes(q))
      );
    }

    if (statusFilter !== "all") {
      result = result.filter((p) => p.status?.toLowerCase() === statusFilter.toLowerCase());
    }

    result.sort((a, b) => {
      const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return sortBy === "newest" ? timeB - timeA : timeA - timeB;
    });

    return result.slice(0, 6);
  }, [projects, searchQuery, statusFilter, sortBy]);

  // Derive actual recent activities
  const recentActivities = useMemo(() => {
    const list: Array<{
      id: string;
      type: "project" | "run";
      title: string;
      subtitle: string;
      date: Date;
      status?: string;
      link: string;
    }> = [];

    // Projects activity
    for (const p of projects) {
      list.push({
        id: `proj-${p.id}`,
        type: "project",
        title: `Project Created: ${p.name}`,
        subtitle: p.objective || p.description || "Research scope initialized",
        date: p.created_at ? new Date(p.created_at) : new Date(),
        status: p.status || "active",
        link: `/dashboard/research?project=${p.id}`
      });
    }

    // Runs activity
    for (const r of runs) {
      const proj = projects.find((p) => p.id === r.project_id);
      list.push({
        id: `run-${r.id}`,
        type: "run",
        title: `Experiment Run: ${r.name}`,
        subtitle: `Project: ${proj ? proj.name : r.project_id}`,
        date: r.created_at ? new Date(r.created_at) : new Date(),
        status: r.status,
        link: `/dashboard/research?tab=runs&project=${r.project_id}`
      });
    }

    // Sort descending by date
    list.sort((a, b) => b.date.getTime() - a.date.getTime());
    return list.slice(0, 6);
  }, [projects, runs]);

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      {/* ===================== WELCOME SECTION ===================== */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-accent/25 bg-accent/10 px-3 py-1 text-xs font-semibold text-accent">
            <Sparkles className="h-3.5 w-3.5" />
            Operator Discovery Plane
          </div>
          <h1 className="mt-2 font-serif text-3xl font-bold tracking-tight text-ink md:text-4xl">
            Welcome back, {user?.name ? user.name.split(" ")[0] : "Researcher"}
          </h1>
          <p className="mt-1 text-sm text-muted">
            Manage your AI research projects, experiments and discoveries.
          </p>
        </div>

        <Button
          onClick={() => setNewProjectOpen(true)}
          className="flex items-center gap-2 px-5 py-3 text-xs font-semibold uppercase tracking-wider shadow-glow self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" />
          New Research Project
        </Button>
      </div>

      {error ? (
        <div className="flex items-center justify-between rounded-2xl border border-rose-300 bg-rose-50/90 p-4 text-xs font-medium text-rose-800">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-danger" />
            <span>{error}</span>
          </div>
          <Button variant="secondary" size="sm" onClick={() => void loadData()}>
            Retry
          </Button>
        </div>
      ) : null}

      {/* ===================== RESEARCH STATISTICS ===================== */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Total Research Projects */}
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted">
              Total Projects
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/10 text-accent">
              <FolderKanban className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 font-serif text-3xl font-bold text-ink">
            {loading ? "..." : totalProjects}
          </div>
          <div className="mt-1 text-[11px] text-muted">
            {totalProjects === 0 ? "No projects created yet" : `${totalProjects} configured brief(s)`}
          </div>
        </Card>

        {/* Card 2: Active Research Projects */}
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted">
              Active Projects
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-700">
              <Activity className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 font-serif text-3xl font-bold text-ink">
            {loading ? "..." : activeProjects}
          </div>
          <div className="mt-1 text-[11px] text-muted">
            {activeProjects === 0 ? "No active research workflows" : `${activeProjects} in progress`}
          </div>
        </Card>

        {/* Card 3: Completed Research Projects */}
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted">
              Completed Projects
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-500/10 text-purple-700">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 font-serif text-3xl font-bold text-ink">
            {loading ? "..." : completedProjects}
          </div>
          <div className="mt-1 text-[11px] text-muted">
            {completedProjects === 0 ? "No completed manuscripts yet" : `${completedProjects} verified papers`}
          </div>
        </Card>

        {/* Card 4: Total Experiment Runs */}
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted">
              Experiment Runs
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 text-blue-700">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 font-serif text-3xl font-bold text-ink">
            {loading ? "..." : totalRuns}
          </div>
          <div className="mt-1 text-[11px] text-muted">
            {totalRuns === 0 ? "No pipeline executions launched" : `${totalRuns} total trial runs`}
          </div>
        </Card>
      </div>

      {/* ===================== RECENT RESEARCH PROJECTS ===================== */}
      <div className="space-y-4">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h2 className="font-serif text-2xl font-bold tracking-tight text-ink">
              Recent Research Projects
            </h2>
            <p className="text-xs text-muted">
              Your most recent scientific inquiry briefs and active experiment scopes.
            </p>
          </div>

          <Link href="/dashboard/projects">
            <Button variant="secondary" size="sm" className="flex items-center gap-1.5 text-xs">
              View All Projects <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>

        {/* Search & Filter Bar */}
        <Card className="p-3.5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1">
              <Input
                placeholder="Filter recent projects..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 text-xs py-2"
              />
              <Search className="absolute left-3 top-3 h-3.5 w-3.5 text-muted/60" />
            </div>

            <div className="flex items-center gap-2">
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-32 text-xs py-2"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="draft">Draft</option>
              </Select>

              <Select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as "newest" | "oldest")}
                className="w-32 text-xs py-2"
              >
                <option value="newest">Newest</option>
                <option value="oldest">Oldest</option>
              </Select>
            </div>
          </div>
        </Card>

        {/* Project Cards / Grid */}
        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="glass-panel h-56 animate-pulse rounded-[28px] border border-border/80 bg-surface/50 p-5" />
            ))}
          </div>
        ) : recentProjects.length === 0 ? (
          <Card className="flex flex-col items-center justify-center p-10 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10 text-accent mb-3">
              <FolderKanban className="h-6 w-6" />
            </div>
            <h3 className="font-serif text-xl font-bold text-ink">
              {searchQuery ? "No matching projects found" : "No research projects found"}
            </h3>
            <p className="mt-1 max-w-sm text-xs text-muted leading-relaxed">
              {searchQuery
                ? "Try clearing your search query to view recent projects."
                : "Create your first project to configure models, compute targets, and start automated loops."}
            </p>
            <Button
              onClick={() => setNewProjectOpen(true)}
              size="sm"
              className="mt-4 flex items-center gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" /> New Project
            </Button>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {recentProjects.map((p) => {
              const runCount = runsCountMap[p.id] || 0;
              const dateStr = p.created_at
                ? new Date(p.created_at).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric"
                  })
                : "Recent";

              return (
                <Card
                  key={p.id}
                  className="flex flex-col justify-between p-5 transition duration-150 hover:shadow-glow"
                >
                  <div>
                    <div className="flex items-center justify-between pb-2.5 border-b border-border/60">
                      <Badge label={p.status || "active"} />
                      <span className="flex items-center gap-1 text-[11px] text-muted">
                        <Calendar className="h-3 w-3" /> {dateStr}
                      </span>
                    </div>

                    <h3 className="mt-3 font-serif text-lg font-bold tracking-tight text-ink line-clamp-1">
                      {p.name}
                    </h3>
                    <p className="mt-1.5 text-xs text-muted line-clamp-2 leading-relaxed">
                      {p.objective || p.description || "Autonomous hypothesis loop configured."}
                    </p>

                    <div className="mt-4 flex items-center justify-between rounded-xl bg-white/60 p-2.5 text-[11px] text-muted border border-border/60">
                      <span className="flex items-center gap-1">
                        <Activity className="h-3.5 w-3.5 text-blue-600" />
                        {runCount} run(s)
                      </span>
                      <span>
                        Budget: {currency(p.budget?.max_cost_usd || 50)}
                      </span>
                    </div>
                  </div>

                  <div className="mt-5 pt-3 border-t border-border/70 flex items-center justify-between">
                    <span className="text-[10px] text-muted font-mono truncate max-w-[140px]">
                      {p.slug}
                    </span>
                    <Link href={`/dashboard/research?project=${p.id}`}>
                      <Button size="sm" className="flex items-center gap-1 text-xs">
                        Open Project <ExternalLink className="h-3 w-3" />
                      </Button>
                    </Link>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* ===================== RECENT ACTIVITY ===================== */}
      <div className="space-y-4">
        <div>
          <h2 className="font-serif text-2xl font-bold tracking-tight text-ink">
            Recent Research Activity
          </h2>
          <p className="text-xs text-muted">
            Live trace of pipeline state transitions, project additions, and metric checkpoints.
          </p>
        </div>

        {recentActivities.length === 0 ? (
          <Card className="flex flex-col items-center justify-center p-8 text-center text-muted">
            <Clock className="h-8 w-8 text-muted/40 mb-2" />
            <p className="text-xs">No recent activity logged yet.</p>
          </Card>
        ) : (
          <Card className="divide-y divide-border/60 overflow-hidden p-0">
            {recentActivities.map((act) => (
              <div
                key={act.id}
                className="flex items-center justify-between p-4 transition hover:bg-white/40"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                      act.type === "project"
                        ? "bg-accent/10 text-accent"
                        : "bg-blue-500/10 text-blue-600"
                    }`}
                  >
                    {act.type === "project" ? (
                      <FolderKanban className="h-4 w-4" />
                    ) : (
                      <Activity className="h-4 w-4" />
                    )}
                  </div>
                  <div>
                    <div className="font-semibold text-xs text-ink">{act.title}</div>
                    <div className="text-[11px] text-muted line-clamp-1">{act.subtitle}</div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {act.status ? <Badge label={act.status} /> : null}
                  <span className="hidden sm:inline text-[11px] text-muted">
                    {act.date.toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric"
                    })}
                  </span>
                  <Link href={act.link}>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-lg">
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </Card>
        )}
      </div>

      {/* New Project Dialog */}
      <NewProjectDialog
        open={newProjectOpen}
        onClose={() => setNewProjectOpen(false)}
        onProjectCreated={() => {
          void loadData();
        }}
      />
    </div>
  );
}
