import {
  Artifact,
  ArtifactContent,
  AuthResponse,
  BusEvent,
  ChatMessage,
  Citation,
  ComputeTarget,
  ModelProfile,
  Project,
  Run,
  User
} from "@/lib/types";
import { apiUrl } from "@/lib/utils";

/**
 * Safe in-memory session reference (NO localStorage token storage).
 * Authentication is securely persisted via HttpOnly SameSite cookies.
 */
let inMemoryToken: string | null = null;

export function getStoredToken(): string | null {
  return inMemoryToken;
}

export function setStoredToken(token: string | null): void {
  inMemoryToken = token;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const url = apiUrl(path);
  const headers: Record<string, string> = {
    "Content-Type": "application/json"
  };

  // If an in-memory token is available (e.g. CLI or temporary bearer), attach it
  if (inMemoryToken) {
    headers["Authorization"] = `Bearer ${inMemoryToken}`;
  }

  let response: Response;
  try {
    response = await fetch(url, {
      credentials: "include", // Enables HttpOnly session cookie transmission
      headers: {
        ...headers,
        ...(init?.headers as Record<string, string> | undefined)
      },
      cache: "no-store",
      ...init
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Cannot connect to backend API at ${url} (${detail}). Please make sure the backend server is running.`
    );
  }

  if (!response.ok) {
    let errMessage = "";
    try {
      const errJson = await response.json();
      errMessage = errJson.detail || JSON.stringify(errJson);
    } catch {
      errMessage = await response.text();
    }
    throw new Error(errMessage || `Request failed with status ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export const api = {
  // Secure Authentication
  register: (payload: {
    name: string;
    email: string;
    password: string;
    confirm_password?: string;
  }) =>
    request<AuthResponse>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(payload)
    }),

  login: (payload: {
    email: string;
    password: string;
    remember_me?: boolean;
  }) =>
    request<AuthResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(payload)
    }),

  logout: () =>
    request<{ detail: string }>("/api/auth/logout", {
      method: "POST"
    }),

  getMe: () => request<User>("/api/auth/me"),
  updateProfile: (payload: { name: string }) =>
    request<User>("/api/auth/me", {
      method: "PATCH",
      body: JSON.stringify(payload)
    }),

  // Projects & Core Research Engine
  listProjects: () => request<Project[]>("/api/projects"),
  createProject: (payload: Record<string, unknown>) =>
    request<Project>("/api/projects", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  getProject: (projectId: string) => request<Project>(`/api/projects/${projectId}`),
  updateProject: (projectId: string, payload: Record<string, unknown>) =>
    request<Project>(`/api/projects/${projectId}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    }),
  deleteProject: (projectId: string) =>
    request<{ message: string; id: string }>(`/api/projects/${projectId}`, {
      method: "DELETE"
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
  retryRun: (runId: string) =>
    request<Run>(`/api/runs/${runId}/retry`, { method: "POST" }),
  listRunEvents: (runId: string) => request<BusEvent[]>(`/api/runs/${runId}/events`),
  listRunLogs: (runId: string) => request<BusEvent[]>(`/api/runs/${runId}/logs`),
  listRunCitations: (runId: string) => request<Citation[]>(`/api/runs/${runId}/citations`),
  listArtifacts: (runId: string) => request<Artifact[]>(`/api/artifacts?run_id=${runId}`),
  getArtifact: (artifactId: string) => request<ArtifactContent>(`/api/artifacts/${artifactId}`),
  downloadArtifactUrl: (artifactId: string) => apiUrl(`/api/artifacts/${artifactId}/download`),
  listChatMessages: (projectId: string) => request<ChatMessage[]>(`/api/chat?project_id=${projectId}`),
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
