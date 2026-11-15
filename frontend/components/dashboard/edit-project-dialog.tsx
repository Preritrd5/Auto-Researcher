"use client";

import React, { useEffect, useState } from "react";
import { X, AlertCircle, Edit3 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input, Textarea, Select, Label } from "@/components/ui/input";
import { api } from "@/lib/api";
import { Project } from "@/lib/types";

interface EditProjectDialogProps {
  project: Project | null;
  open: boolean;
  onClose: () => void;
  onProjectUpdated: (updated: Project) => void;
}

export function EditProjectDialog({
  project,
  open,
  onClose,
  onProjectUpdated
}: EditProjectDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [objective, setObjective] = useState("");
  const [status, setStatus] = useState("active");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (project) {
      setName(project.name || "");
      setDescription(project.description || "");
      setObjective(project.objective || "");
      setStatus(project.status || "active");
      setError(null);
    }
  }, [project, open]);

  if (!open || !project) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!project) return;
    setError(null);

    const cleanName = name.trim();
    if (!cleanName) {
      setError("Project name cannot be empty.");
      return;
    }

    try {
      setIsSubmitting(true);
      const updated = await api.updateProject(project.id, {
        name: cleanName,
        description: description.trim(),
        objective: objective.trim(),
        status
      });
      onProjectUpdated(updated);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update project details.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="glass-panel w-full max-w-lg rounded-[28px] border border-border bg-surface p-6 shadow-panel">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent/15 text-accent">
              <Edit3 className="h-4 w-4" />
            </div>
            <h3 className="font-serif text-xl font-bold text-ink">Edit Project Details</h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted hover:bg-white/60 hover:text-ink transition"
            aria-label="Close dialog"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {error ? (
          <div className="mt-4 flex items-start gap-2.5 rounded-2xl border border-danger/30 bg-danger/10 p-3 text-xs text-danger">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <Label htmlFor="edit-name">Project Name</Label>
            <Input
              id="edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="edit-objective">Research Objective / Hypothesis</Label>
            <Textarea
              id="edit-objective"
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              rows={3}
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="edit-desc">Scope Description</Label>
            <Input
              id="edit-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="edit-status">Project Status</Label>
            <Select
              id="edit-status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="mt-1"
            >
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="draft">Draft</option>
              <option value="archived">Archived</option>
            </Select>
          </div>

          <div className="mt-6 flex items-center justify-end gap-3 pt-3 border-t border-border">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              Save Changes
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
