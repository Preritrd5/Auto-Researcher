"use client";

import React, { useState } from "react";
import { AlertTriangle, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { Project } from "@/lib/types";

interface DeleteProjectDialogProps {
  project: Project | null;
  open: boolean;
  onClose: () => void;
  onDeleted: (projectId: string) => void;
}

export function DeleteProjectDialog({
  project,
  open,
  onClose,
  onDeleted
}: DeleteProjectDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open || !project) return null;

  async function handleDelete() {
    if (!project) return;
    setError(null);
    try {
      setIsDeleting(true);
      await api.deleteProject(project.id);
      onDeleted(project.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete project.");
      setIsDeleting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="glass-panel w-full max-w-md rounded-[28px] border border-border bg-surface p-6 shadow-panel">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2 text-danger font-serif text-xl font-bold">
            <AlertTriangle className="h-5 w-5" />
            Delete Research Project
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
          <div className="mt-4 rounded-xl border border-danger/30 bg-danger/10 p-3 text-xs text-danger">
            {error}
          </div>
        ) : null}

        <div className="mt-4 space-y-3 text-xs leading-relaxed text-muted">
          <p>
            Are you sure you want to permanently delete{" "}
            <strong className="text-ink font-semibold">&ldquo;{project.name}&rdquo;</strong>?
          </p>
          <p className="rounded-xl border border-rose-200 bg-rose-50/70 p-3 text-rose-800">
            This will permanently remove the project brief, configured budgets, and associated pipeline run histories from the local database.
          </p>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3 pt-3 border-t border-border">
          <Button type="button" variant="ghost" onClick={onClose} disabled={isDeleting}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="danger"
            isLoading={isDeleting}
            onClick={handleDelete}
          >
            <Trash2 className="mr-1.5 h-4 w-4" />
            Confirm Deletion
          </Button>
        </div>
      </div>
    </div>
  );
}
