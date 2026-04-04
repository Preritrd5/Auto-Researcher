import {
  Artifact,
  ArtifactContent,
  ComputeTarget,
  ModelProfile,
  Project,
  Run
} from "@/lib/types";
import { apiUrl } from "@/lib/utils";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(apiUrl(path), {
    headers: {
      "Content-Type": "application/json"
    },
    cache: "no-store",
    ...init
  });
  if (!response.ok) {
    throw new Error(await response.text());
  }
  return response.json() as Promise<T>;
}

export const api = {
  listProjects: () => request<Project[]>("/api/projects"),
  createProject: (payload: Record<string, unknown>) =>
    request<Project>("/api/projects", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  listProfiles: () => request<ModelProfile[]>("/api/model-profiles"),
  createProfile: (payload: Record<string, unknown>) =>
    request<ModelProfile>("/api/model-profiles", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  listComputeTargets: () => request<ComputeTarget[]>("/api/compute-targets"),
  createComputeTarget: (payload: Record<string, unknown>) =>
    request<ComputeTarget>("/api/compute-targets", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  listRuns: (projectId?: string) =>
    request<Run[]>(`/api/runs${projectId ? `?project_id=${projectId}` : ""}`),
  createRun: (payload: Record<string, unknown>) =>
    request<Run>("/api/runs", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  getRun: (runId: string) => request<Run>(`/api/runs/${runId}`),
  stopRun: (runId: string) =>
    request<{ message: string }>(`/api/runs/${runId}/stop`, { method: "POST" }),
  listArtifacts: (runId: string) => request<Artifact[]>(`/api/artifacts?run_id=${runId}`),
  getArtifact: (artifactId: string) => request<ArtifactContent>(`/api/artifacts/${artifactId}`),
  chat: (payload: Record<string, unknown>) =>
    request<{ reply: string; model_name: string; degraded: boolean }>("/api/chat", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  testProvider: (payload: Record<string, unknown>) =>
    request<{ ok: boolean; message: string; latency_ms?: number; sample: string }>("/api/providers/test", {
      method: "POST",
      body: JSON.stringify(payload)
    })
};

