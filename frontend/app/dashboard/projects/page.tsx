"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  FolderKanban,
  Plus,
  Search,
  Filter,
  ArrowUpDown,
  ExternalLink,
  Edit2,
  Trash2,
  Activity,
  DollarSign,
  Clock,
  Sparkles,
  Calendar,
  Layers,
  AlertCircle
} from "lucide-react";

import { useAuth } from "@/components/auth/auth-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { NewProjectDialog } from "@/components/dashboard/new-project-dialog";
import { EditProjectDialog } from "@/components/dashboard/edit-project-dialog";
import { DeleteProjectDialog } from "@/components/dashboard/delete-project-dialog";
import { api } from "@/lib/api";
import { Project, Run } from "@/lib/types";
import { currency } from "@/lib/utils";

export default function ResearchProjectsPage() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "name">("newest");

  // Dialog states
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [deletingProject, setDeletingProject] = useState<Project | null>(null);

  async function loadProjects() {
    try {
      setLoading(true);
      const [projList, runList] = await Promise.all([
        api.listProjects(),
        api.listRuns()
      ]);
      setProjects(projList);
      setRuns(runList);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load research projects.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadProjects();
  }, []);

  // Filtered & Sorted Projects
  const filteredProjects = useMemo(() => {
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
      if (sortBy === "name") {
        return a.name.localeCompare(b.name);
      }
      const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return sortBy === "newest" ? timeB - timeA : timeA - timeB;
    });

    return result;
  }, [projects, searchQuery, statusFilter, sortBy]);

  // Project runs mapping
  const runsCountMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const r of runs) {
      map[r.project_id] = (map[r.project_id] || 0) + 1;
    }
    return map;
  }, [runs]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Top Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-accent">
            <FolderKanban className="h-4 w-4" />
            Research Repository
          </div>
          <h1 className="mt-1 font-serif text-3xl font-bold tracking-tight text-ink md:text-4xl">
            Research Projects
          </h1>
          <p className="mt-1 text-sm text-muted">
            Configure hypotheses, manage guardrail budgets, and orchestrate automated experiment runs.
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
          <Button variant="secondary" size="sm" onClick={() => void loadProjects()}>
            Retry
          </Button>
        </div>
      ) : null}

      {/* Filter and Search Bar */}
      <Card className="p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          {/* Search Box */}
          <div className="relative flex-1">
            <Input
              placeholder="Search projects by title, hypothesis or scope..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 text-xs"
            />
            <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-muted/60" />
          </div>

          {/* Status Filter and Sort */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted/60" />
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-36 text-xs py-2"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="draft">Draft</option>
                <option value="archived">Archived</option>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <ArrowUpDown className="h-4 w-4 text-muted/60" />
              <Select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as "newest" | "oldest" | "name")}
                className="w-36 text-xs py-2"
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="name">Alphabetical</option>
              </Select>
            </div>
          </div>
        </div>
      </Card>

      {/* Projects Grid */}
      {loading ? (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="glass-panel h-64 animate-pulse rounded-[28px] border border-border/80 bg-surface/50 p-6"
            />
          ))}
        </div>
      ) : filteredProjects.length === 0 ? (
        <Card className="flex flex-col items-center justify-center p-12 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/10 text-accent mb-4">
            <FolderKanban className="h-7 w-7" />
          </div>
          <h3 className="font-serif text-2xl font-bold text-ink">
            {searchQuery || statusFilter !== "all"
              ? "No matching research projects"
              : "No research projects initialized yet"}
          </h3>
          <p className="mt-2 max-w-md text-xs text-muted leading-relaxed">
            {searchQuery || statusFilter !== "all"
              ? "Try adjusting your search criteria or resetting filters to find what you are looking for."
              : "Begin your autonomous research workflow by defining an objective, setting budget guardrails, and launching your first pipeline."}
          </p>
          <div className="mt-6">
            <Button onClick={() => setNewProjectOpen(true)} className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Create First Project
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {filteredProjects.map((project) => {
            const projectRuns = runsCountMap[project.id] || 0;
            const spentUsd = project.budget?.spent_cost_usd || 0;
            const maxUsd = project.budget?.max_cost_usd || 50;
            const budgetPct = Math.min(100, Math.round((spentUsd / maxUsd) * 100));
            const formattedDate = project.created_at
              ? new Date(project.created_at).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric"
                })
              : "Active";

            return (
              <Card
                key={project.id}
                className="flex flex-col justify-between p-6 transition duration-150 hover:shadow-glow"
              >
                <div>
                  {/* Top Status & Date */}
                  <div className="flex items-center justify-between pb-3 border-b border-border/60">
                    <Badge label={project.status || "active"} />
                    <span className="flex items-center gap-1 text-[11px] text-muted">
                      <Calendar className="h-3 w-3" />
                      {formattedDate}
                    </span>
                  </div>

                  {/* Title & Objective */}
                  <h3 className="mt-4 font-serif text-xl font-bold tracking-tight text-ink line-clamp-1">
                    {project.name}
                  </h3>

                  <p className="mt-2 text-xs text-muted line-clamp-3 leading-relaxed">
                    {project.objective || project.description || "No formal hypothesis documented yet."}
                  </p>

                  {/* Budget & Stats */}
                  <div className="mt-5 space-y-3 rounded-2xl bg-white/60 p-3.5 border border-border/60">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted flex items-center gap-1">
                        <DollarSign className="h-3.5 w-3.5 text-accent" /> Budget Utilization
                      </span>
                      <span className="font-semibold text-ink">
                        {currency(spentUsd)} / {currency(maxUsd)} ({budgetPct}%)
                      </span>
                    </div>

                    <div className="h-1.5 w-full rounded-full bg-border/40 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-accent transition-all duration-300"
                        style={{ width: `${budgetPct}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between pt-1 text-[11px] text-muted">
                      <span className="flex items-center gap-1">
                        <Activity className="h-3 w-3 text-blue-600" />
                        {projectRuns} experiment run(s)
                      </span>
                      <span>Slug: {project.slug}</span>
                    </div>
                  </div>
                </div>

                {/* Card Footer Actions */}
                <div className="mt-6 flex items-center justify-between gap-2 pt-4 border-t border-border/70">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setEditingProject(project)}
                      title="Edit project details"
                      className="rounded-xl border border-border p-2 text-muted hover:bg-white hover:text-ink transition"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => setDeletingProject(project)}
                      title="Delete project"
                      className="rounded-xl border border-border p-2 text-muted hover:bg-rose-50 hover:text-danger hover:border-danger/30 transition"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <Link href={`/dashboard/research?project=${project.id}`}>
                    <Button size="sm" className="flex items-center gap-1.5 text-xs">
                      Open Console <ExternalLink className="h-3 w-3" />
                    </Button>
                  </Link>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modals */}
      <NewProjectDialog
        open={newProjectOpen}
        onClose={() => setNewProjectOpen(false)}
        onProjectCreated={(newProj) => {
          setProjects((prev) => [newProj, ...prev]);
        }}
      />

      <EditProjectDialog
        project={editingProject}
        open={!!editingProject}
        onClose={() => setEditingProject(null)}
        onProjectUpdated={(updated) => {
          setProjects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
        }}
      />

      <DeleteProjectDialog
        project={deletingProject}
        open={!!deletingProject}
        onClose={() => setDeletingProject(null)}
        onDeleted={(deletedId) => {
          setProjects((prev) => prev.filter((p) => p.id !== deletedId));
        }}
      />
    </div>
  );
}
