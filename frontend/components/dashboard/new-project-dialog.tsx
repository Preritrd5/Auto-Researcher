"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Sparkles, AlertCircle, Cpu, Server, DollarSign, Clock, Layers } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input, Textarea, Select, Label } from "@/components/ui/input";
import { api } from "@/lib/api";
import { ComputeTarget, ModelProfile, Project } from "@/lib/types";

interface NewProjectDialogProps {
  open: boolean;
  onClose: () => void;
  onProjectCreated?: (project: Project) => void;
}

export function NewProjectDialog({ open, onClose, onProjectCreated }: NewProjectDialogProps) {
  const router = useRouter();

  const [name, setName] = useState("");
  const [question, setQuestion] = useState("");
  const [objective, setObjective] = useState("");
  const [domain, setDomain] = useState("Natural Language Processing");
  const [description, setDescription] = useState("");
  const [autoLaunch, setAutoLaunch] = useState(true);
  const [primaryModelId, setPrimaryModelId] = useState("");
  const [criticModelId, setCriticModelId] = useState("");
  const [computeTargetId, setComputeTargetId] = useState("");
  const [maxCostUsd, setMaxCostUsd] = useState(50);
  const [maxRuntimeMinutes, setMaxRuntimeMinutes] = useState(360);
  const [maxTokens, setMaxTokens] = useState(2000000);

  const [profiles, setProfiles] = useState<ModelProfile[]>([]);
  const [computeTargets, setComputeTargets] = useState<ComputeTarget[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    async function loadOptions() {
      try {
        setLoadingOptions(true);
        const [profList, compList] = await Promise.all([
          api.listProfiles(),
          api.listComputeTargets()
        ]);
        setProfiles(profList);
        setComputeTargets(compList);
        if (compList.length > 0 && !computeTargetId) {
          setComputeTargetId(compList[0].id);
        }
        if (profList.length > 0 && !primaryModelId) {
          setPrimaryModelId(profList[0].id);
          setCriticModelId(profList.length > 1 ? profList[1].id : profList[0].id);
        }
      } catch (err) {
        console.warn("Could not load options for new project dialog:", err);
      } finally {
        setLoadingOptions(false);
      }
    }
    void loadOptions();
  }, [open]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const cleanName = name.trim();
    if (!cleanName) {
      setError("Please provide a project name.");
      return;
    }
    const cleanObjective = objective.trim();
    if (!cleanObjective) {
      setError("Please define the research objective or core hypothesis.");
      return;
    }

    try {
      setIsSubmitting(true);
      const payload = {
        name: cleanName,
        objective: cleanObjective,
        description: description.trim(),
        primary_model_profile_id: primaryModelId || undefined,
        critic_model_profile_id: criticModelId || undefined,
        default_compute_target_id: computeTargetId || undefined,
        settings: {
          domain,
          research_question: question.trim()
        },
        budget: {
          max_cost_usd: Number(maxCostUsd) || 50,
          max_runtime_minutes: Number(maxRuntimeMinutes) || 360,
          max_tokens: Number(maxTokens) || 2000000
        }
      };

      const created = await api.createProject(payload);
      if (onProjectCreated) {
        onProjectCreated(created);
      }

      // If user selected to launch immediately, create initial run
      if (autoLaunch) {
        await api.createRun({
          project_id: created.id,
          name: `Run 1: ${cleanName}`,
          input_prompt: question.trim() || cleanObjective,
          context: {
            domain,
            research_question: question.trim(),
            objective: cleanObjective,
            description: description.trim()
          }
        });
      }

      onClose();
      // Redirect to the newly created project in Research Console
      router.push(`/dashboard/research?tab=pipeline&project=${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create project");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="glass-panel w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-[32px] border border-border bg-surface p-6 shadow-panel md:p-8">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-white shadow-glow">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <h2 className="font-serif text-2xl font-bold text-ink">New Research Project</h2>
              <p className="text-xs text-muted">Initialize an autonomous research brief and compute workspace.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-2 text-muted hover:bg-white/60 hover:text-ink transition"
            aria-label="Close dialog"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error ? (
          <div className="mt-4 flex items-start gap-2.5 rounded-2xl border border-danger/30 bg-danger/10 p-3.5 text-xs text-danger">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          {/* Project Name */}
          <div>
            <Label htmlFor="proj-name">Project Name *</Label>
            <Input
              id="proj-name"
              placeholder="e.g. Ultra-Low-Latency Audio Transformer Optimization"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="mt-1.5"
            />
          </div>

          {/* Research Domain & Category */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="proj-domain">Research Domain</Label>
              <Select
                id="proj-domain"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                className="mt-1.5"
              >
                <option value="Natural Language Processing">Natural Language Processing</option>
                <option value="Computer Vision & Multimodal">Computer Vision & Multimodal</option>
                <option value="Speech & Audio Processing">Speech & Audio Processing</option>
                <option value="Reinforcement Learning & Robotics">Reinforcement Learning & Robotics</option>
                <option value="Generative Modeling & Diffusion">Generative Modeling & Diffusion</option>
                <option value="Physics & Scientific ML">Physics & Scientific ML</option>
                <option value="Model Compression & Edge AI">Model Compression & Edge AI</option>
                <option value="Optimization / Other">Optimization / Other</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="proj-question">Specific Research Question</Label>
              <Input
                id="proj-question"
                placeholder="e.g. Can 4-bit INT4 weights preserve baseline accuracy?"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                className="mt-1.5"
              />
            </div>
          </div>

          {/* Research Objective */}
          <div>
            <Label htmlFor="proj-objective">Research Objective / Core Hypothesis *</Label>
            <Textarea
              id="proj-objective"
              placeholder="Formulate the problem statement, baseline models to compare against, and expected empirical target..."
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              required
              className="mt-1.5 min-h-[90px]"
            />
          </div>

          {/* Description */}
          <div>
            <Label htmlFor="proj-desc">Scope Description (Optional)</Label>
            <Input
              id="proj-desc"
              placeholder="Target benchmarks (e.g. LibriSpeech, AudioSet), hardware constraints..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1.5"
            />
          </div>

          {/* Model and Compute Selectors */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="primary-model">Primary Generator Model</Label>
              <Select
                id="primary-model"
                value={primaryModelId}
                onChange={(e) => setPrimaryModelId(e.target.value)}
                className="mt-1.5"
              >
                <option value="">Default Gateway Model</option>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.model_name})
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <Label htmlFor="critic-model">Critic / Adversarial Reviewer</Label>
              <Select
                id="critic-model"
                value={criticModelId}
                onChange={(e) => setCriticModelId(e.target.value)}
                className="mt-1.5"
              >
                <option value="">Default Gateway Critic</option>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.model_name})
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="compute-target">Compute Target Runtime</Label>
            <Select
              id="compute-target"
              value={computeTargetId}
              onChange={(e) => setComputeTargetId(e.target.value)}
              className="mt-1.5"
            >
              {computeTargets.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.kind})
                </option>
              ))}
            </Select>
          </div>

          {/* Budget Limits */}
          <div className="rounded-2xl border border-border/80 bg-white/50 p-4">
            <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-accent flex items-center gap-1.5">
              <DollarSign className="h-3.5 w-3.5" /> Hard Budget Guardrails
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <Label htmlFor="max-cost">Max Cost ($ USD)</Label>
                <Input
                  id="max-cost"
                  type="number"
                  min="1"
                  max="5000"
                  value={maxCostUsd}
                  onChange={(e) => setMaxCostUsd(Number(e.target.value))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="max-runtime">Max Runtime (Minutes)</Label>
                <Input
                  id="max-runtime"
                  type="number"
                  min="10"
                  max="14400"
                  value={maxRuntimeMinutes}
                  onChange={(e) => setMaxRuntimeMinutes(Number(e.target.value))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="max-tokens">Max Token Quota</Label>
                <Input
                  id="max-tokens"
                  type="number"
                  min="10000"
                  max="50000000"
                  step="100000"
                  value={maxTokens}
                  onChange={(e) => setMaxTokens(Number(e.target.value))}
                  className="mt-1"
                />
              </div>
            </div>
          </div>

          {/* Autonomous Execution Option */}
          <div className="flex items-center gap-3 rounded-2xl border border-accent/30 bg-accent/5 p-4">
            <input
              id="auto-launch"
              type="checkbox"
              checked={autoLaunch}
              onChange={(e) => setAutoLaunch(e.target.checked)}
              className="h-4 w-4 rounded border-border text-accent focus:ring-accent/40"
            />
            <label htmlFor="auto-launch" className="text-sm font-medium text-ink cursor-pointer">
              Launch autonomous research run immediately upon project creation
              <span className="block text-xs text-muted font-normal">
                Initializes the 10-stage research pipeline (literature scan, hypothesis generation, experiment execution, claim analysis) in the background.
              </span>
            </label>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              {autoLaunch ? "Initialize & Launch Research Run" : "Initialize Project Workspace"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
