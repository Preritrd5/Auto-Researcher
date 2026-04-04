export type Budget = {
  id: string;
  max_cost_usd: number;
  max_runtime_minutes: number;
  max_tokens: number;
  spent_cost_usd: number;
  spent_tokens: number;
};

export type Project = {
  id: string;
  name: string;
  slug: string;
  description: string;
  objective: string;
  status: string;
  primary_model_profile_id?: string | null;
  critic_model_profile_id?: string | null;
  default_compute_target_id?: string | null;
  settings: Record<string, unknown>;
  budget?: Budget | null;
};

export type ModelProfile = {
  id: string;
  name: string;
  provider_kind: string;
  model_name: string;
  base_url: string;
  api_key_env: string;
  cli_command: string;
  capabilities: Record<string, unknown>;
  profile_metadata: Record<string, unknown>;
  active: boolean;
};

export type ComputeTarget = {
  id: string;
  name: string;
  kind: string;
  priority: number;
  active: boolean;
  config: Record<string, unknown>;
};

export type Stage = {
  id: string;
  stage_key: string;
  stage_index: number;
  status: string;
  attempt_count: number;
  error_message: string;
  failure_class: string;
  output_snapshot: Record<string, unknown>;
};

export type Run = {
  id: string;
  project_id: string;
  name: string;
  status: string;
  current_stage_key?: string | null;
  stage_cursor: number;
  input_prompt: string;
  context: Record<string, unknown>;
  retry_count: number;
  total_cost_usd: number;
  total_tokens: number;
  failure_class?: string | null;
  stages: Stage[];
};

export type Artifact = {
  id: string;
  run_id: string;
  stage_id?: string | null;
  kind: string;
  relative_path: string;
  mime_type: string;
  checksum: string;
  size_bytes: number;
  artifact_metadata: Record<string, unknown>;
};

export type ArtifactContent = {
  artifact: Artifact;
  content: string;
};

export type BusEvent = {
  event_type: string;
  message: string;
  payload: Record<string, unknown>;
};
