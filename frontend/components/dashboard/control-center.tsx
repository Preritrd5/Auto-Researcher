"use client";

import {
  Activity,
  Bot,
  FileText,
  FolderKanban,
  Languages,
  Play,
  RadioTower,
  Wallet
} from "lucide-react";
import { useEffect, useState, useTransition } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { api } from "@/lib/api";
import { dictionaries, LANGUAGE_STORAGE_KEY, languageMeta, type Language } from "@/lib/i18n";
import { Artifact, ArtifactContent, BusEvent, ComputeTarget, ModelProfile, Project, Run } from "@/lib/types";
import { cn, currency, wsUrl } from "@/lib/utils";

type Pane = "setup" | "pipeline" | "chat" | "artifacts" | "runs";

type ChatReplyState = {
  reply: string;
  modelName: string;
  degraded: boolean;
};

type ProviderTestState = {
  ok: boolean;
  message: string;
  sample: string;
};

function providerOptionLabel(kind: string, language: Language) {
  if (language === "zh") {
    if (kind === "openai_compatible") return "openai_compatible（兼容 OpenAI 协议）";
    if (kind === "openai_native") return "openai_native（OpenAI 原生）";
    if (kind === "anthropic_native") return "anthropic_native（Anthropic 原生）";
    if (kind === "cli_agent") return "cli_agent（命令行代理）";
    return kind;
  }

  if (kind === "openai_compatible") return "openai_compatible (OpenAI-compatible)";
  if (kind === "openai_native") return "openai_native (OpenAI native)";
  if (kind === "anthropic_native") return "anthropic_native (Anthropic native)";
  if (kind === "cli_agent") return "cli_agent (Command-line agent)";
  return kind;
}

function formatStatus(status: string | null | undefined, language: Language) {
  const t = dictionaries[language];
  if (!status) return t.common.unknown;
  return t.status[status as keyof typeof t.status] || status;
}

function formatStageKey(stageKey: string | null | undefined, language: Language) {
  const t = dictionaries[language];
  if (!stageKey) return t.common.idle;
  return t.stages[stageKey as keyof typeof t.stages] || stageKey.replaceAll("_", " ");
}

function formatFailureClass(failureClass: string | null | undefined, language: Language) {
  const t = dictionaries[language];
  if (!failureClass) return t.common.none;
  return t.failureClass[failureClass as keyof typeof t.failureClass] || failureClass;
}

function formatEventType(eventType: string | null | undefined, language: Language) {
  const t = dictionaries[language];
  if (!eventType) return language === "zh" ? "事件" : "Event";
  return t.eventType[eventType as keyof typeof t.eventType] || eventType;
}

function formatEventMessage(event: BusEvent, language: Language) {
  const stageKey = typeof event.payload?.stage_key === "string" ? event.payload.stage_key : null;
  const stageLabel = stageKey ? formatStageKey(stageKey, language) : null;

  if (event.event_type === "run.completed") {
    return language === "zh" ? "运行已完成" : "Run completed";
  }

  if (event.event_type === "stage.started" && stageLabel) {
    return language === "zh" ? `${stageLabel}已开始` : `${stageLabel} started`;
  }

  if (event.event_type === "stage.completed" && stageLabel) {
    return language === "zh" ? `${stageLabel}已完成` : `${stageLabel} completed`;
  }

  if (event.event_type === "log" && stageLabel && event.message.endsWith(": completed")) {
    return language === "zh" ? `${stageLabel}：已完成` : `${stageLabel}: completed`;
  }

  if (event.event_type === "stage.failed" && stageLabel) {
    return language === "zh" ? `${stageLabel}失败：${event.message}` : `${stageLabel} failed: ${event.message}`;
  }

  if (event.event_type === "bus.degraded") {
    return language === "zh"
      ? "Redis 不可用，实时流已降级，当前仍会尽量继续展示状态。"
      : "Redis is unavailable, so realtime streaming is running in degraded mode while the UI stays usable.";
  }

  return event.message;
}

function formatChatReply(reply: ChatReplyState, language: Language) {
  if (language === "zh") {
    return `${reply.reply}\n\n（模型：${reply.modelName}${reply.degraded ? "，降级模式" : ""}）`;
  }
  return `${reply.reply}\n\n(Model: ${reply.modelName}${reply.degraded ? ", degraded mode" : ""})`;
}

function formatProviderTest(result: ProviderTestState, language: Language) {
  const t = dictionaries[language];
  return `${result.ok ? t.common.passed : t.common.failedShort} · ${result.message}${
    result.sample ? ` · ${result.sample}` : ""
  }`;
}

function runtimeSubtitle(target: ComputeTarget, language: Language) {
  return language === "zh"
    ? `${target.kind} · 优先级 ${target.priority}`
    : `${target.kind} · priority ${target.priority}`;
}

export function ControlCenter() {
  const [language, setLanguage] = useState<Language>("en");
  const [activePane, setActivePane] = useState<Pane>("setup");
  const [projects, setProjects] = useState<Project[]>([]);
  const [profiles, setProfiles] = useState<ModelProfile[]>([]);
  const [computeTargets, setComputeTargets] = useState<ComputeTarget[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedRunId, setSelectedRunId] = useState("");
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [artifactContent, setArtifactContent] = useState<ArtifactContent | null>(null);
  const [chatReply, setChatReply] = useState<ChatReplyState | null>(null);
  const [eventFeed, setEventFeed] = useState<BusEvent[]>([]);
  const [logFeed, setLogFeed] = useState<BusEvent[]>([]);
  const [isPending, startTransition] = useTransition();
  const [providerTest, setProviderTest] = useState<ProviderTestState | null>(null);

  const [projectForm, setProjectForm] = useState({
    name: "",
    description: "",
    objective: "",
    primary_model_profile_id: "",
    critic_model_profile_id: "",
    default_compute_target_id: ""
  });
  const [profileForm, setProfileForm] = useState({
    name: "",
    provider_kind: "openai_compatible",
    model_name: "",
    base_url: "",
    api_key_env: "",
    cli_command: "",
    profile_metadata: "{}"
  });
  const [computeForm, setComputeForm] = useState({
    name: "",
    kind: "local",
    priority: 100,
    config: "{\n  \"workdir\": \".\",\n  \"python_bin\": \"python3\"\n}"
  });
  const [runForm, setRunForm] = useState({
    name: "",
    input_prompt: ""
  });
  const [chatMessage, setChatMessage] = useState("");

  const t = dictionaries[language];
  const locale = languageMeta[language].locale;
  const paneList: Array<{ key: Pane; label: string; icon: typeof FolderKanban }> = [
    { key: "setup", label: t.panes.setup, icon: FolderKanban },
    { key: "pipeline", label: t.panes.pipeline, icon: Activity },
    { key: "chat", label: t.panes.chat, icon: Bot },
    { key: "artifacts", label: t.panes.artifacts, icon: FileText },
    { key: "runs", label: t.panes.runs, icon: Wallet }
  ];

  useEffect(() => {
    const savedLanguage = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (savedLanguage === "en" || savedLanguage === "zh") {
      setLanguage(savedLanguage);
    }
    void refreshAll();
  }, []);

  useEffect(() => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    document.documentElement.lang = languageMeta[language].htmlLang;
    document.title = languageMeta[language].title;
    const description = document.querySelector('meta[name="description"]');
    if (description) {
      description.setAttribute("content", languageMeta[language].description);
    }
  }, [language]);

  useEffect(() => {
    if (!selectedProjectId && projects[0]) {
      setSelectedProjectId(projects[0].id);
    }
  }, [projects, selectedProjectId]);

  useEffect(() => {
    if (!selectedProjectId) {
      setRuns([]);
      setSelectedRunId("");
      return;
    }

    void api.listRuns(selectedProjectId).then((nextRuns) => {
      setRuns(nextRuns);
      if (!nextRuns.some((run) => run.id === selectedRunId)) {
        setSelectedRunId(nextRuns[0]?.id || "");
      }
    });
  }, [selectedProjectId, selectedRunId]);

  useEffect(() => {
    if (!selectedRunId) {
      setArtifacts([]);
      setArtifactContent(null);
      setEventFeed([]);
      setLogFeed([]);
      return;
    }

    void api.listArtifacts(selectedRunId).then(setArtifacts);
    const eventsSocket = new WebSocket(`${wsUrl("/ws/events")}?run_id=${selectedRunId}`);
    const logsSocket = new WebSocket(`${wsUrl("/ws/logs")}?run_id=${selectedRunId}`);

    eventsSocket.onmessage = (event) => {
      const payload = JSON.parse(event.data) as BusEvent;
      setEventFeed((current) => [payload, ...current].slice(0, 24));
      startTransition(() => {
        void api.getRun(selectedRunId).then((run) => {
          setRuns((current) => current.map((item) => (item.id === run.id ? run : item)));
        });
        void api.listArtifacts(selectedRunId).then(setArtifacts);
      });
    };

    logsSocket.onmessage = (event) => {
      const payload = JSON.parse(event.data) as BusEvent;
      setLogFeed((current) => [payload, ...current].slice(0, 48));
    };

    return () => {
      eventsSocket.close();
      logsSocket.close();
    };
  }, [selectedRunId]);

  async function refreshAll() {
    const [nextProjects, nextProfiles, nextTargets] = await Promise.all([
      api.listProjects(),
      api.listProfiles(),
      api.listComputeTargets()
    ]);
    setProjects(nextProjects);
    setProfiles(nextProfiles);
    setComputeTargets(nextTargets);
  }

  async function submitProject() {
    await api.createProject({
      ...projectForm,
      primary_model_profile_id: projectForm.primary_model_profile_id || null,
      critic_model_profile_id: projectForm.critic_model_profile_id || null,
      default_compute_target_id: projectForm.default_compute_target_id || null,
      budget: {
        max_cost_usd: 50,
        max_runtime_minutes: 360,
        max_tokens: 2000000
      }
    });
    setProjectForm({
      name: "",
      description: "",
      objective: "",
      primary_model_profile_id: "",
      critic_model_profile_id: "",
      default_compute_target_id: ""
    });
    await refreshAll();
  }

  async function submitProfile() {
    await api.createProfile({
      ...profileForm,
      profile_metadata: JSON.parse(profileForm.profile_metadata || "{}")
    });
    setProfileForm({
      name: "",
      provider_kind: "openai_compatible",
      model_name: "",
      base_url: "",
      api_key_env: "",
      cli_command: "",
      profile_metadata: "{}"
    });
    await refreshAll();
  }

  async function submitComputeTarget() {
    await api.createComputeTarget({
      ...computeForm,
      priority: Number(computeForm.priority),
      config: JSON.parse(computeForm.config)
    });
    setComputeForm({
      name: "",
      kind: "local",
      priority: 100,
      config: "{\n  \"workdir\": \".\",\n  \"python_bin\": \"python3\"\n}"
    });
    await refreshAll();
  }

  async function launchRun() {
    if (!selectedProjectId) return;
    const run = await api.createRun({
      project_id: selectedProjectId,
      name: runForm.name || `${t.pipeline.defaultRunPrefix} ${new Date().toLocaleTimeString(locale)}`,
      input_prompt: runForm.input_prompt,
      context: {}
    });
    setRunForm({ name: "", input_prompt: "" });
    setSelectedRunId(run.id);
    setRuns((current) => [run, ...current]);
    setActivePane("pipeline");
  }

  async function sendChat() {
    if (!selectedProjectId || !chatMessage.trim()) return;
    const response = await api.chat({
      project_id: selectedProjectId,
      run_id: selectedRunId || null,
      message: chatMessage
    });
    setChatReply({
      reply: response.reply,
      modelName: response.model_name,
      degraded: response.degraded
    });
    setChatMessage("");
  }

  async function testProfile(profileId: string) {
    const response = await api.testProvider({ profile_id: profileId, prompt: "Say provider ok." });
    setProviderTest({
      ok: response.ok,
      message: response.message,
      sample: response.sample
    });
  }

  const selectedProject = projects.find((item) => item.id === selectedProjectId);
  const selectedRun = runs.find((item) => item.id === selectedRunId);
  const topBudget = selectedProject?.budget;

  return (
    <main className="mx-auto min-h-screen max-w-[1600px] px-4 py-6 md:px-8">
      <div className="grid gap-5 xl:grid-cols-[280px_minmax(0,1fr)]">
        <Card className="h-fit xl:sticky xl:top-6">
          <div className="mb-8">
            <div className="mb-2 text-xs font-semibold uppercase tracking-[0.3em] text-accent">
              Auto-Researcher v1
            </div>
            <h1 className="font-serif text-4xl leading-none text-ink">{t.sidebar.title}</h1>
            <p className="mt-4 text-sm leading-6 text-muted">{t.sidebar.description}</p>
          </div>

          <div className="mb-6 rounded-[24px] border border-border bg-white/70 p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink">
              <Languages className="h-4 w-4 text-accent" />
              {t.sidebar.language}
            </div>
            <div className="inline-flex rounded-full bg-surface p-1">
              {(Object.keys(languageMeta) as Language[]).map((item) => (
                <button
                  key={item}
                  onClick={() => setLanguage(item)}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-sm transition",
                    language === item ? "bg-accent text-white shadow-glow" : "text-muted hover:bg-white"
                  )}
                  aria-pressed={language === item}
                >
                  {languageMeta[item].label}
                </button>
              ))}
            </div>
            <p className="mt-3 text-xs leading-5 text-muted">{t.sidebar.languageHint}</p>
          </div>

          <div className="space-y-2">
            {paneList.map((pane) => {
              const Icon = pane.icon;
              const active = activePane === pane.key;
              return (
                <button
                  key={pane.key}
                  onClick={() => setActivePane(pane.key)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left transition",
                    active ? "bg-accent text-white shadow-glow" : "bg-white/60 text-ink hover:bg-white"
                  )}
                >
                  <span className="flex items-center gap-3">
                    <Icon className="h-4 w-4" />
                    <span className="text-sm font-medium">{pane.label}</span>
                  </span>
                  {pane.key === "pipeline" && selectedRun ? (
                    <Badge label={formatStatus(selectedRun.status, language)} tone={selectedRun.status} />
                  ) : null}
                </button>
              );
            })}
          </div>

          <div className="mt-8 rounded-3xl border border-border bg-white/70 p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink">
              <RadioTower className="h-4 w-4 text-accent" />
              {t.sidebar.liveStatus}
            </div>
            <div className="space-y-3 text-sm text-muted">
              <div>
                <div className="text-xs uppercase tracking-[0.16em]">{t.sidebar.project}</div>
                <div className="mt-1 text-ink">{selectedProject?.name || t.sidebar.noneSelected}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-[0.16em]">{t.sidebar.run}</div>
                <div className="mt-1 text-ink">{selectedRun?.name || t.sidebar.noActiveRun}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-[0.16em]">{t.sidebar.spentBudget}</div>
                <div className="mt-1 text-ink">{currency(topBudget?.spent_cost_usd || 0, locale)}</div>
              </div>
            </div>
          </div>
        </Card>

        <div className="space-y-5">
          {activePane === "setup" ? (
            <div className="grid gap-5 xl:grid-cols-3">
              <Card>
                <CardTitle
                  eyebrow={t.setup.step1}
                  title={t.setup.title}
                  description={t.setup.description}
                />
                <div className="space-y-3">
                  <Input
                    placeholder={t.setup.projectName}
                    value={projectForm.name}
                    onChange={(event) => setProjectForm({ ...projectForm, name: event.target.value })}
                  />
                  <Textarea
                    placeholder={t.setup.problemDescription}
                    value={projectForm.description}
                    onChange={(event) => setProjectForm({ ...projectForm, description: event.target.value })}
                  />
                  <Textarea
                    placeholder={t.setup.objective}
                    value={projectForm.objective}
                    onChange={(event) => setProjectForm({ ...projectForm, objective: event.target.value })}
                    className="min-h-[100px]"
                  />
                  <select
                    className="w-full rounded-2xl border border-border bg-white/80 px-4 py-3 text-sm"
                    value={projectForm.primary_model_profile_id}
                    onChange={(event) =>
                      setProjectForm({ ...projectForm, primary_model_profile_id: event.target.value })
                    }
                  >
                    <option value="">{t.setup.primaryModel}</option>
                    {profiles.map((profile) => (
                      <option key={profile.id} value={profile.id}>
                        {profile.name}
                      </option>
                    ))}
                  </select>
                  <select
                    className="w-full rounded-2xl border border-border bg-white/80 px-4 py-3 text-sm"
                    value={projectForm.critic_model_profile_id}
                    onChange={(event) =>
                      setProjectForm({ ...projectForm, critic_model_profile_id: event.target.value })
                    }
                  >
                    <option value="">{t.setup.criticModel}</option>
                    {profiles.map((profile) => (
                      <option key={profile.id} value={profile.id}>
                        {profile.name}
                      </option>
                    ))}
                  </select>
                  <select
                    className="w-full rounded-2xl border border-border bg-white/80 px-4 py-3 text-sm"
                    value={projectForm.default_compute_target_id}
                    onChange={(event) =>
                      setProjectForm({ ...projectForm, default_compute_target_id: event.target.value })
                    }
                  >
                    <option value="">{t.setup.defaultCompute}</option>
                    {computeTargets.map((target) => (
                      <option key={target.id} value={target.id}>
                        {target.name}
                      </option>
                    ))}
                  </select>
                  <Button onClick={submitProject} disabled={!projectForm.name.trim()}>
                    {t.setup.createProject}
                  </Button>
                </div>
              </Card>

              <Card>
                <CardTitle
                  eyebrow={t.setup.step2}
                  title={t.setup.modelTitle}
                  description={t.setup.modelDescription}
                />
                <div className="space-y-3">
                  <Input
                    placeholder={t.setup.profileName}
                    value={profileForm.name}
                    onChange={(event) => setProfileForm({ ...profileForm, name: event.target.value })}
                  />
                  <select
                    className="w-full rounded-2xl border border-border bg-white/80 px-4 py-3 text-sm"
                    value={profileForm.provider_kind}
                    onChange={(event) => setProfileForm({ ...profileForm, provider_kind: event.target.value })}
                  >
                    <option value="openai_compatible">{providerOptionLabel("openai_compatible", language)}</option>
                    <option value="openai_native">{providerOptionLabel("openai_native", language)}</option>
                    <option value="anthropic_native">{providerOptionLabel("anthropic_native", language)}</option>
                    <option value="cli_agent">{providerOptionLabel("cli_agent", language)}</option>
                  </select>
                  <Input
                    placeholder={t.setup.modelName}
                    value={profileForm.model_name}
                    onChange={(event) => setProfileForm({ ...profileForm, model_name: event.target.value })}
                  />
                  <Input
                    placeholder={t.setup.baseUrl}
                    value={profileForm.base_url}
                    onChange={(event) => setProfileForm({ ...profileForm, base_url: event.target.value })}
                  />
                  <Input
                    placeholder={t.setup.apiKeyEnv}
                    value={profileForm.api_key_env}
                    onChange={(event) => setProfileForm({ ...profileForm, api_key_env: event.target.value })}
                  />
                  <Input
                    placeholder={t.setup.cliCommand}
                    value={profileForm.cli_command}
                    onChange={(event) => setProfileForm({ ...profileForm, cli_command: event.target.value })}
                  />
                  <Textarea
                    placeholder='{"api_key":"optional-inline-key"}'
                    value={profileForm.profile_metadata}
                    onChange={(event) => setProfileForm({ ...profileForm, profile_metadata: event.target.value })}
                    className="min-h-[96px] font-mono text-xs"
                  />
                  <div className="flex gap-3">
                    <Button onClick={submitProfile} disabled={!profileForm.name || !profileForm.model_name}>
                      {t.setup.saveProfile}
                    </Button>
                    {profiles[0] ? (
                      <Button variant="secondary" onClick={() => void testProfile(profiles[0].id)}>
                        {t.setup.testLatestProfile}
                      </Button>
                    ) : null}
                  </div>
                  {providerTest ? (
                    <div className="rounded-2xl bg-white/80 px-4 py-3 text-sm text-muted">
                      {formatProviderTest(providerTest, language)}
                    </div>
                  ) : null}
                </div>
              </Card>

              <Card>
                <CardTitle
                  eyebrow={t.setup.step3}
                  title={t.setup.computeTitle}
                  description={t.setup.computeDescription}
                />
                <div className="space-y-3">
                  <Input
                    placeholder={t.setup.computeName}
                    value={computeForm.name}
                    onChange={(event) => setComputeForm({ ...computeForm, name: event.target.value })}
                  />
                  <select
                    className="w-full rounded-2xl border border-border bg-white/80 px-4 py-3 text-sm"
                    value={computeForm.kind}
                    onChange={(event) => setComputeForm({ ...computeForm, kind: event.target.value })}
                  >
                    <option value="local">local</option>
                    <option value="docker">docker</option>
                    <option value="ssh">ssh</option>
                  </select>
                  <Input
                    placeholder={t.setup.priority}
                    type="number"
                    value={String(computeForm.priority)}
                    onChange={(event) => setComputeForm({ ...computeForm, priority: Number(event.target.value) })}
                  />
                  <Textarea
                    value={computeForm.config}
                    onChange={(event) => setComputeForm({ ...computeForm, config: event.target.value })}
                    className="min-h-[180px] font-mono text-xs"
                  />
                  <Button onClick={submitComputeTarget} disabled={!computeForm.name.trim()}>
                    {t.setup.saveCompute}
                  </Button>
                </div>
              </Card>

              <Card className="xl:col-span-3">
                <CardTitle
                  eyebrow={t.setup.inventoryEyebrow}
                  title={t.setup.inventoryTitle}
                  description={t.setup.inventoryDescription}
                />
                <div className="grid gap-4 md:grid-cols-3">
                  <InventoryBlock
                    title={t.setup.projects}
                    emptyText={t.common.noConfig}
                    items={projects.map((project) => ({
                      title: project.name,
                      subtitle: project.objective || project.description || t.common.objectiveMissing,
                      action: () => {
                        setSelectedProjectId(project.id);
                        setActivePane("pipeline");
                      }
                    }))}
                  />
                  <InventoryBlock
                    title={t.setup.modelProfiles}
                    emptyText={t.common.noConfig}
                    items={profiles.map((profile) => ({
                      title: profile.name,
                      subtitle: `${profile.provider_kind} · ${profile.model_name}`,
                      action: () => void testProfile(profile.id)
                    }))}
                  />
                  <InventoryBlock
                    title={t.setup.computeTargets}
                    emptyText={t.common.noConfig}
                    items={computeTargets.map((target) => ({
                      title: target.name,
                      subtitle: runtimeSubtitle(target, language)
                    }))}
                  />
                </div>
              </Card>
            </div>
          ) : null}

          {activePane === "pipeline" ? (
            <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
              <Card>
                <CardTitle
                  eyebrow={t.pipeline.eyebrow}
                  title={t.pipeline.title}
                  description={t.pipeline.description}
                />
                <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
                  <div className="space-y-3">
                    <select
                      className="w-full rounded-2xl border border-border bg-white/80 px-4 py-3 text-sm"
                      value={selectedProjectId}
                      onChange={(event) => setSelectedProjectId(event.target.value)}
                    >
                      <option value="">{t.common.selectProject}</option>
                      {projects.map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.name}
                        </option>
                      ))}
                    </select>
                    <Input
                      placeholder={t.pipeline.runName}
                      value={runForm.name}
                      onChange={(event) => setRunForm({ ...runForm, name: event.target.value })}
                    />
                    <Textarea
                      placeholder={t.pipeline.runPrompt}
                      value={runForm.input_prompt}
                      onChange={(event) => setRunForm({ ...runForm, input_prompt: event.target.value })}
                      className="min-h-[140px]"
                    />
                    <div className="flex gap-3">
                      <Button onClick={launchRun} disabled={!selectedProjectId}>
                        <Play className="mr-2 h-4 w-4" />
                        {t.pipeline.startRun}
                      </Button>
                      {selectedRun ? (
                        <Button variant="danger" onClick={() => void api.stopRun(selectedRun.id)}>
                          {t.pipeline.stopRun}
                        </Button>
                      ) : null}
                    </div>
                  </div>

                  <div className="rounded-[24px] border border-border bg-white/70 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <div>
                        <div className="text-xs uppercase tracking-[0.18em] text-muted">{t.pipeline.currentRun}</div>
                        <div className="mt-1 font-serif text-2xl">
                          {selectedRun?.name || t.pipeline.noRunSelected}
                        </div>
                      </div>
                      {selectedRun ? (
                        <Badge label={formatStatus(selectedRun.status, language)} tone={selectedRun.status} />
                      ) : null}
                    </div>
                    <div className="space-y-3">
                      {(selectedRun?.stages || [])
                        .sort((left, right) => left.stage_index - right.stage_index)
                        .map((stage) => (
                          <div key={stage.id} className="rounded-2xl border border-border bg-surface/90 px-4 py-3">
                            <div className="mb-2 flex items-center justify-between gap-3">
                              <div>
                                <div className="text-xs uppercase tracking-[0.14em] text-muted">
                                  {t.common.stage} {stage.stage_index}
                                </div>
                                <div className="font-medium text-ink">{formatStageKey(stage.stage_key, language)}</div>
                              </div>
                              <Badge label={formatStatus(stage.status, language)} tone={stage.status} />
                            </div>
                            <div className="text-sm text-muted">
                              {t.common.attempts}: {stage.attempt_count}
                              {stage.failure_class
                                ? ` · ${t.common.failureType}: ${formatFailureClass(stage.failure_class, language)}`
                                : ""}
                            </div>
                            {stage.error_message ? (
                              <div className="mt-2 rounded-2xl bg-[#fff1ed] px-3 py-2 text-sm text-danger">
                                {stage.error_message}
                              </div>
                            ) : null}
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              </Card>

              <Card>
                <CardTitle
                  eyebrow={t.pipeline.eventsEyebrow}
                  title={t.pipeline.eventsTitle}
                  description={t.pipeline.eventsDescription}
                />
                <div className="grid gap-4 lg:grid-cols-2">
                  <FeedColumn
                    title={t.pipeline.events}
                    items={eventFeed}
                    language={language}
                    emptyText={t.common.waitingEvents}
                  />
                  <FeedColumn
                    title={t.pipeline.logs}
                    items={logFeed}
                    language={language}
                    emptyText={t.common.waitingEvents}
                  />
                </div>
                <div className="mt-4 rounded-3xl border border-border bg-white/70 p-4">
                  <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink">
                    <Wallet className="h-4 w-4 text-accent" />
                    {t.pipeline.budgetSnapshot}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Metric label={t.pipeline.spentCost} value={currency(topBudget?.spent_cost_usd || 0, locale)} />
                    <Metric
                      label={t.pipeline.tokenBudget}
                      value={`${topBudget?.spent_tokens || 0} / ${topBudget?.max_tokens || 0}`}
                    />
                    <Metric label={t.pipeline.refreshState} value={isPending ? t.common.syncing : t.common.live} />
                  </div>
                </div>
              </Card>
            </div>
          ) : null}

          {activePane === "chat" ? (
            <div className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
              <Card>
                <CardTitle
                  eyebrow={t.chat.eyebrow}
                  title={t.chat.title}
                  description={t.chat.description}
                />
                <div className="space-y-3">
                  <select
                    className="w-full rounded-2xl border border-border bg-white/80 px-4 py-3 text-sm"
                    value={selectedProjectId}
                    onChange={(event) => setSelectedProjectId(event.target.value)}
                  >
                    <option value="">{t.common.selectProject}</option>
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                  <Textarea
                    placeholder={t.chat.placeholder}
                    value={chatMessage}
                    onChange={(event) => setChatMessage(event.target.value)}
                    className="min-h-[240px]"
                  />
                  <Button onClick={sendChat} disabled={!selectedProjectId || !chatMessage.trim()}>
                    {t.chat.send}
                  </Button>
                </div>
              </Card>
              <Card>
                <CardTitle
                  eyebrow={t.chat.responseEyebrow}
                  title={t.chat.responseTitle}
                  description={t.chat.responseDescription}
                />
                <pre className="max-h-[520px] overflow-auto whitespace-pre-wrap rounded-[24px] border border-border bg-[#f8f4ec] p-5 font-mono text-sm leading-6 text-ink">
                  {chatReply ? formatChatReply(chatReply, language) : t.common.noResponse}
                </pre>
              </Card>
            </div>
          ) : null}

          {activePane === "artifacts" ? (
            <div className="grid gap-5 xl:grid-cols-[0.75fr_1.25fr]">
              <Card>
                <CardTitle
                  eyebrow={t.artifacts.eyebrow}
                  title={t.artifacts.title}
                  description={t.artifacts.description}
                />
                <div className="space-y-3">
                  <select
                    className="w-full rounded-2xl border border-border bg-white/80 px-4 py-3 text-sm"
                    value={selectedRunId}
                    onChange={(event) => setSelectedRunId(event.target.value)}
                  >
                    <option value="">{t.common.selectRun}</option>
                    {runs.map((run) => (
                      <option key={run.id} value={run.id}>
                        {run.name}
                      </option>
                    ))}
                  </select>
                  <div className="space-y-2">
                    {artifacts.map((artifact) => (
                      <button
                        key={artifact.id}
                        onClick={async () => setArtifactContent(await api.getArtifact(artifact.id))}
                        className="flex w-full items-center justify-between rounded-2xl border border-border bg-white/75 px-4 py-3 text-left hover:bg-white"
                      >
                        <div>
                          <div className="text-sm font-medium text-ink">{artifact.relative_path}</div>
                          <div className="text-xs uppercase tracking-[0.16em] text-muted">{artifact.kind}</div>
                        </div>
                        <Badge label={artifact.mime_type.split("/").pop() || t.common.file} />
                      </button>
                    ))}
                  </div>
                </div>
              </Card>
              <Card>
                <CardTitle
                  eyebrow={t.artifacts.previewEyebrow}
                  title={artifactContent?.artifact.relative_path || t.common.noArtifact}
                  description={t.artifacts.previewDescription}
                />
                <pre className="max-h-[640px] overflow-auto whitespace-pre-wrap rounded-[24px] border border-border bg-[#f8f4ec] p-5 font-mono text-sm leading-6 text-ink">
                  {artifactContent?.content || t.common.noArtifact}
                </pre>
              </Card>
            </div>
          ) : null}

          {activePane === "runs" ? (
            <div className="grid gap-5 xl:grid-cols-[1fr_0.9fr]">
              <Card>
                <CardTitle
                  eyebrow={t.runs.eyebrow}
                  title={t.runs.title}
                  description={t.runs.description}
                />
                <div className="space-y-3">
                  {runs.map((run) => (
                    <button
                      key={run.id}
                      onClick={() => setSelectedRunId(run.id)}
                      className={cn(
                        "w-full rounded-[24px] border px-5 py-4 text-left transition",
                        run.id === selectedRunId ? "border-accent bg-white" : "border-border bg-white/70 hover:bg-white"
                      )}
                    >
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <div className="font-serif text-xl text-ink">{run.name}</div>
                        <Badge label={formatStatus(run.status, language)} tone={run.status} />
                      </div>
                      <div className="grid gap-2 sm:grid-cols-3">
                        <Metric label={t.runs.currentStage} value={formatStageKey(run.current_stage_key, language)} />
                        <Metric label={t.runs.retries} value={String(run.retry_count)} />
                        <Metric label={t.runs.cost} value={currency(run.total_cost_usd, locale)} />
                      </div>
                    </button>
                  ))}
                </div>
              </Card>
              <Card>
                <CardTitle
                  eyebrow={t.runs.snapshotEyebrow}
                  title={t.runs.snapshotTitle}
                  description={t.runs.snapshotDescription}
                />
                {selectedRun ? (
                  <div className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Metric label={t.runs.runId} value={selectedRun.id.slice(0, 8)} />
                      <Metric label={t.common.failureType} value={formatFailureClass(selectedRun.failure_class, language)} />
                      <Metric label={t.runs.stageCursor} value={String(selectedRun.stage_cursor)} />
                      <Metric label={t.runs.tokens} value={String(selectedRun.total_tokens)} />
                    </div>
                    <div className="rounded-[24px] border border-border bg-white/70 p-4">
                      <div className="mb-2 text-xs uppercase tracking-[0.16em] text-muted">{t.common.prompt}</div>
                      <div className="text-sm leading-6 text-ink">
                        {selectedRun.input_prompt || t.common.noPrompt}
                      </div>
                    </div>
                    <div className="rounded-[24px] border border-border bg-white/70 p-4">
                      <div className="mb-2 text-xs uppercase tracking-[0.16em] text-muted">
                        {t.common.latestStageOutput}
                      </div>
                      <pre className="max-h-[280px] overflow-auto whitespace-pre-wrap font-mono text-xs leading-6 text-ink">
                        {JSON.stringify(
                          selectedRun.stages[selectedRun.stages.length - 1]?.output_snapshot || {},
                          null,
                          2
                        )}
                      </pre>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-[24px] border border-dashed border-border bg-white/60 p-6 text-sm text-muted">
                    {t.runs.noSelection}
                  </div>
                )}
              </Card>
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
}

function InventoryBlock({
  title,
  items,
  emptyText
}: {
  title: string;
  items: Array<{ title: string; subtitle: string; action?: () => void }>;
  emptyText: string;
}) {
  return (
    <div className="rounded-[24px] border border-border bg-white/70 p-4">
      <div className="mb-3 text-sm font-semibold text-ink">{title}</div>
      <div className="space-y-2">
        {items.length ? (
          items.map((item) => (
            <button
              key={`${title}-${item.title}`}
              onClick={item.action}
              className="w-full rounded-2xl bg-surface px-3 py-3 text-left hover:bg-white"
            >
              <div className="text-sm font-medium text-ink">{item.title}</div>
              <div className="mt-1 text-xs leading-5 text-muted">{item.subtitle}</div>
            </button>
          ))
        ) : (
          <div className="rounded-2xl border border-dashed border-border px-3 py-4 text-sm text-muted">
            {emptyText}
          </div>
        )}
      </div>
    </div>
  );
}

function FeedColumn({
  title,
  items,
  language,
  emptyText
}: {
  title: string;
  items: BusEvent[];
  language: Language;
  emptyText: string;
}) {
  return (
    <div className="rounded-[24px] border border-border bg-white/70 p-4">
      <div className="mb-3 text-sm font-semibold text-ink">{title}</div>
      <div className="max-h-[420px] space-y-2 overflow-auto">
        {items.length ? (
          items.map((item, index) => (
            <div key={`${title}-${index}`} className="rounded-2xl bg-surface px-3 py-3">
              <div className="text-xs uppercase tracking-[0.16em] text-muted">
                {formatEventType(item.event_type, language)}
              </div>
              <div className="mt-1 text-sm text-ink">{formatEventMessage(item, language)}</div>
            </div>
          ))
        ) : (
          <div className="rounded-2xl border border-dashed border-border px-3 py-4 text-sm text-muted">
            {emptyText}
          </div>
        )}
      </div>
    </div>
  );
}

function Metric({
  label,
  value
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl bg-surface px-4 py-3">
      <div className="text-xs uppercase tracking-[0.16em] text-muted">{label}</div>
      <div className="mt-1 text-sm font-medium text-ink">{value}</div>
    </div>
  );
}
