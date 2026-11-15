"use client";

import {
  Activity,
  AlertCircle,
  ArrowRight,
  BookOpen,
  Bot,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Cpu,
  Download,
  ExternalLink,
  FileCode,
  FileText,
  FolderKanban,
  Languages,
  Play,
  RadioTower,
  RefreshCw,
  RotateCcw,
  Sparkles,
  StopCircle,
  Wallet
} from "lucide-react";
import { useEffect, useState, useTransition, useRef } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { api } from "@/lib/api";
import { dictionaries, LANGUAGE_STORAGE_KEY, languageMeta, type Language } from "@/lib/i18n";
import { Artifact, ArtifactContent, BusEvent, ChatMessage, Citation, ComputeTarget, ModelProfile, Project, Run } from "@/lib/types";
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

const STAGE_ARTIFACT_MAP: Record<string, string> = {
  brief_intake: "brief.md",
  literature_scan: "literature_report.md",
  idea_generation: "idea_board.json",
  novelty_feasibility_ranking: "idea_board.json",
  proposal_drafting: "proposal.md",
  experiment_planning: "experiment_plan.yaml",
  code_generation: "workspace_snapshot/experiment.py",
  experiment_run_refine_loop: "run_metrics.json",
  analysis_result_to_claim: "analysis_report.md",
  paper_drafting_review_export: "paper/paper.md"
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
    return language === "zh" ? "运行已完成" : "Run completed successfully across all stages";
  }

  if (event.event_type === "run.retried") {
    return language === "zh" ? "操作员已发起重试" : "Operator initiated stage retry";
  }

  if (event.event_type === "stage.started" && stageLabel) {
    return language === "zh" ? `${stageLabel}已开始` : `${stageLabel} execution started`;
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
      ? "Redis 不可用，实时流已降级，使用弹性轮询继续展示状态。"
      : "Realtime bus in degraded mode (Redis unavailable); resilient polling active.";
  }

  return event.message;
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

export function ControlCenter({
  initialPane,
  initialProjectId
}: {
  initialPane?: Pane;
  initialProjectId?: string;
} = {}) {
  const [language, setLanguage] = useState<Language>("en");
  const [activePane, setActivePane] = useState<Pane>(initialPane || "setup");
  const [projects, setProjects] = useState<Project[]>([]);
  const [profiles, setProfiles] = useState<ModelProfile[]>([]);
  const [computeTargets, setComputeTargets] = useState<ComputeTarget[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState(initialProjectId || "");
  const [selectedRunId, setSelectedRunId] = useState("");
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [artifactContent, setArtifactContent] = useState<ArtifactContent | null>(null);
  const [citations, setCitations] = useState<Citation[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isChatSending, setIsChatSending] = useState(false);
  const [eventFeed, setEventFeed] = useState<BusEvent[]>([]);
  const [logFeed, setLogFeed] = useState<BusEvent[]>([]);
  const [activeFeedTab, setActiveFeedTab] = useState<"events" | "logs" | "citations">("events");
  const [copiedArtifact, setCopiedArtifact] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);

  const [isPending, startTransition] = useTransition();
  const [providerTest, setProviderTest] = useState<ProviderTestState | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

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
    input_prompt: "",
    research_question: "",
    domain: "Natural Language Processing"
  });
  const [chatMessage, setChatMessage] = useState("");

  const chatScrollRef = useRef<HTMLDivElement>(null);
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
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get("tab") as Pane | null;
      if (tabParam && ["setup", "pipeline", "chat", "artifacts", "runs"].includes(tabParam)) {
        setActivePane(tabParam);
      }
      const projParam = params.get("project");
      if (projParam) {
        setSelectedProjectId(projParam);
      }
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

  // Load runs and chat messages when selected project changes
  useEffect(() => {
    if (!selectedProjectId) {
      setRuns([]);
      setSelectedRunId("");
      setChatMessages([]);
      return;
    }

    void api
      .listRuns(selectedProjectId)
      .then((nextRuns) => {
        setRuns(nextRuns);
        if (!nextRuns.some((run) => run.id === selectedRunId)) {
          setSelectedRunId(nextRuns[0]?.id || "");
        }
      })
      .catch((err) => {
        console.error("listRuns error:", err);
      });

    void api
      .listChatMessages(selectedProjectId)
      .then(setChatMessages)
      .catch((err) => {
        console.warn("listChatMessages error:", err);
      });
  }, [selectedProjectId, selectedRunId]);

  // Scroll chat to bottom on new messages
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages, isChatSending]);

  // Active run monitoring: WebSockets + resilient polling fallback
  useEffect(() => {
    if (!selectedRunId) {
      setArtifacts([]);
      setArtifactContent(null);
      setCitations([]);
      setEventFeed([]);
      setLogFeed([]);
      return;
    }

    let isMounted = true;

    const pollRunState = async () => {
      try {
        const [updatedRun, nextArtifacts, nextEvents, nextLogs, nextCitations] = await Promise.all([
          api.getRun(selectedRunId),
          api.listArtifacts(selectedRunId),
          api.listRunEvents(selectedRunId).catch(() => []),
          api.listRunLogs(selectedRunId).catch(() => []),
          api.listRunCitations(selectedRunId).catch(() => [])
        ]);

        if (!isMounted) return;

        setRuns((current) => current.map((item) => (item.id === updatedRun.id ? updatedRun : item)));
        setArtifacts(nextArtifacts);
        if (nextEvents.length > 0) setEventFeed(nextEvents);
        if (nextLogs.length > 0) setLogFeed(nextLogs);
        if (nextCitations.length > 0) setCitations(nextCitations);

        return updatedRun.status;
      } catch (err) {
        console.warn("pollRunState notice:", err);
      }
    };

    // Initial immediate fetch
    void pollRunState();

    // Setup resilient 2.5s polling interval
    const pollInterval = setInterval(async () => {
      const status = await pollRunState();
      if (status && ["completed", "failed", "stopped"].includes(status)) {
        clearInterval(pollInterval);
      }
    }, 2500);

    // Also connect to WebSockets for live push events
    const eventsSocket = new WebSocket(`${wsUrl("/ws/events")}?run_id=${selectedRunId}`);
    const logsSocket = new WebSocket(`${wsUrl("/ws/logs")}?run_id=${selectedRunId}`);

    eventsSocket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as BusEvent;
        setEventFeed((current) => [payload, ...current].slice(0, 50));
        void pollRunState();
      } catch (e) {
        console.error("Failed to parse event message:", e);
      }
    };

    logsSocket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as BusEvent;
        setLogFeed((current) => [payload, ...current].slice(0, 100));
      } catch (e) {
        console.error("Failed to parse log message:", e);
      }
    };

    return () => {
      isMounted = false;
      clearInterval(pollInterval);
      eventsSocket.close();
      logsSocket.close();
    };
  }, [selectedRunId]);

  async function refreshAll() {
    try {
      const [nextProjects, nextProfiles, nextTargets] = await Promise.all([
        api.listProjects(),
        api.listProfiles(),
        api.listComputeTargets()
      ]);
      setProjects(nextProjects);
      setProfiles(nextProfiles);
      setComputeTargets(nextTargets);
      setApiError(null);
    } catch (err) {
      console.error("refreshAll error:", err);
      const msg = err instanceof Error ? err.message : String(err);
      setApiError(msg);
    }
  }

  async function submitProject() {
    try {
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
    } catch (err) {
      console.error("submitProject error:", err);
      setApiError(err instanceof Error ? err.message : String(err));
    }
  }

  async function submitProfile() {
    try {
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
    } catch (err) {
      console.error("submitProfile error:", err);
      setApiError(err instanceof Error ? err.message : String(err));
    }
  }

  async function submitComputeTarget() {
    try {
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
    } catch (err) {
      console.error("submitComputeTarget error:", err);
      setApiError(err instanceof Error ? err.message : String(err));
    }
  }

  async function launchRun() {
    if (!selectedProjectId) return;
    try {
      const run = await api.createRun({
        project_id: selectedProjectId,
        name: runForm.name || `${t.pipeline.defaultRunPrefix} ${new Date().toLocaleTimeString(locale)}`,
        input_prompt: runForm.input_prompt || selectedProject?.objective || "Autonomous research loop",
        context: {
          domain: runForm.domain,
          research_question: runForm.research_question
        }
      });
      setRunForm({ name: "", input_prompt: "", research_question: "", domain: "Natural Language Processing" });
      setSelectedRunId(run.id);
      setRuns((current) => [run, ...current]);
      setActivePane("pipeline");
    } catch (err) {
      console.error("launchRun error:", err);
      setApiError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleRetryRun(runId: string) {
    try {
      setIsRetrying(true);
      const updated = await api.retryRun(runId);
      setRuns((current) => current.map((r) => (r.id === updated.id ? updated : r)));
    } catch (err) {
      console.error("handleRetryRun error:", err);
      setApiError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsRetrying(false);
    }
  }

  async function sendChat(customMessage?: string) {
    const textToSend = customMessage || chatMessage;
    if (!selectedProjectId || !textToSend.trim() || isChatSending) return;

    const userMessage: ChatMessage = {
      id: "opt-" + Date.now(),
      role: "user",
      content: textToSend.trim(),
      created_at: new Date().toISOString()
    };
    setChatMessages((prev) => [...prev, userMessage]);
    if (!customMessage) setChatMessage("");
    setIsChatSending(true);

    try {
      const response = await api.chat({
        project_id: selectedProjectId,
        run_id: selectedRunId || null,
        message: textToSend.trim()
      });
      const assistantMessage: ChatMessage = {
        id: "resp-" + Date.now(),
        role: "assistant",
        content: response.reply,
        model_name: response.model_name,
        degraded: response.degraded,
        created_at: new Date().toISOString()
      };
      setChatMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      console.error("sendChat error:", err);
      setApiError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsChatSending(false);
    }
  }

  async function testProfile(profileId: string) {
    try {
      const response = await api.testProvider({ profile_id: profileId, prompt: "Say provider ok." });
      setProviderTest({
        ok: response.ok,
        message: response.message,
        sample: response.sample
      });
    } catch (err) {
      console.error("testProfile error:", err);
      setProviderTest({
        ok: false,
        message: err instanceof Error ? err.message : String(err),
        sample: ""
      });
    }
  }

  function viewArtifactForStage(stageKey: string) {
    const targetFilename = STAGE_ARTIFACT_MAP[stageKey];
    const match = artifacts.find(
      (a) => a.relative_path.includes(targetFilename) || a.kind.includes(stageKey)
    );
    if (match) {
      void api.getArtifact(match.id).then((content) => {
        setArtifactContent(content);
        setActivePane("artifacts");
      });
    } else {
      setActivePane("artifacts");
    }
  }

  const selectedProject = projects.find((item) => item.id === selectedProjectId);
  const selectedRun = runs.find((item) => item.id === selectedRunId);
  const topBudget = selectedProject?.budget;

  const completedStagesCount = (selectedRun?.stages || []).filter((s) => s.status === "completed").length;
  const progressPercent = Math.min(100, Math.round((completedStagesCount / 10) * 100));

  const promptSuggestions = [
    "Summarize literature review findings and verified citations",
    "Analyze the latest experiment metrics and identify trade-offs",
    "Critique the current research hypothesis and suggest refinements",
    "Draft the research paper abstract and experimental setup"
  ];

  return (
    <main className="mx-auto min-h-screen max-w-[1600px] px-4 py-6 md:px-8">
      <div className="grid gap-5 xl:grid-cols-[280px_minmax(0,1fr)]">
        {/* Navigation Sidebar */}
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
                <div className="mt-1 text-ink truncate font-medium">{selectedProject?.name || t.sidebar.noneSelected}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-[0.16em]">{t.sidebar.run}</div>
                <div className="mt-1 text-ink truncate font-medium">{selectedRun?.name || t.sidebar.noActiveRun}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-[0.16em]">{t.sidebar.spentBudget}</div>
                <div className="mt-1 text-ink font-medium">{currency(topBudget?.spent_cost_usd || 0, locale)}</div>
              </div>
            </div>
          </div>
        </Card>

        {/* Main Content Area */}
        <div className="space-y-5">
          {apiError ? (
            <div className="flex flex-col gap-2 rounded-2xl border border-rose-300 bg-rose-50/90 p-4 text-sm text-rose-800 shadow-sm md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-danger" />
                <span className="font-semibold">{language === "zh" ? "服务提示" : "Service Notice"}:</span>
                <span>{apiError}</span>
              </div>
              <Button
                variant="secondary"
                className="self-start md:self-auto"
                onClick={() => void refreshAll()}
              >
                {t.common.retry}
              </Button>
            </div>
          ) : null}

          {/* Pane 1: Setup */}
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

          {/* Pane 2: Live Pipeline */}
          {activePane === "pipeline" ? (
            <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
              <Card>
                <CardTitle
                  eyebrow={t.pipeline.eyebrow}
                  title={t.pipeline.title}
                  description={t.pipeline.description}
                />

                {/* Progress bar */}
                {selectedRun ? (
                  <div className="mb-5 rounded-2xl border border-border bg-white/70 p-4">
                    <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted">
                      <span>Research Progression</span>
                      <span className="text-accent">{completedStagesCount} / 10 stages completed ({progressPercent}%)</span>
                    </div>
                    <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-surface">
                      <div
                        className="h-full rounded-full bg-accent transition-all duration-500 shadow-glow"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  </div>
                ) : null}

                <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
                  {/* Initiation Form */}
                  <div className="space-y-3">
                    <div className="text-xs font-semibold uppercase tracking-wider text-muted">
                      Initiate Autonomous Run
                    </div>
                    <select
                      className="w-full rounded-2xl border border-border bg-white/80 px-4 py-3 text-sm font-medium"
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

                    <Input
                      placeholder="Specific Research Question (Optional)"
                      value={runForm.research_question}
                      onChange={(event) => setRunForm({ ...runForm, research_question: event.target.value })}
                    />

                    <Textarea
                      placeholder={t.pipeline.runPrompt}
                      value={runForm.input_prompt}
                      onChange={(event) => setRunForm({ ...runForm, input_prompt: event.target.value })}
                      className="min-h-[120px]"
                    />

                    <div className="flex flex-wrap gap-2 pt-2">
                      <Button onClick={launchRun} disabled={!selectedProjectId}>
                        <Play className="mr-1.5 h-4 w-4" />
                        {t.pipeline.startRun}
                      </Button>
                      {selectedRun && ["failed", "stopped"].includes(selectedRun.status) ? (
                        <Button
                          variant="secondary"
                          onClick={() => handleRetryRun(selectedRun.id)}
                          disabled={isRetrying}
                        >
                          <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                          Retry Stage
                        </Button>
                      ) : null}
                      {selectedRun && ["running", "queued"].includes(selectedRun.status) ? (
                        <Button variant="danger" onClick={() => void api.stopRun(selectedRun.id)}>
                          <StopCircle className="mr-1.5 h-4 w-4" />
                          {t.pipeline.stopRun}
                        </Button>
                      ) : null}
                    </div>
                  </div>

                  {/* Stage Records List */}
                  <div className="rounded-[24px] border border-border bg-white/70 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <div>
                        <div className="text-xs uppercase tracking-[0.18em] text-muted">{t.pipeline.currentRun}</div>
                        <div className="mt-1 font-serif text-xl text-ink truncate max-w-[220px]">
                          {selectedRun?.name || t.pipeline.noRunSelected}
                        </div>
                      </div>
                      {selectedRun ? (
                        <Badge label={formatStatus(selectedRun.status, language)} tone={selectedRun.status} />
                      ) : null}
                    </div>

                    <div className="max-h-[500px] space-y-2.5 overflow-y-auto pr-1">
                      {(selectedRun?.stages || [])
                        .sort((left, right) => left.stage_index - right.stage_index)
                        .map((stage) => {
                          const isDone = stage.status === "completed";
                          const isRunning = stage.status === "running";
                          const hasOutput = isDone && Boolean(STAGE_ARTIFACT_MAP[stage.stage_key]);

                          return (
                            <div
                              key={stage.id}
                              className={cn(
                                "rounded-2xl border px-3.5 py-3 transition",
                                isRunning
                                  ? "border-accent bg-accent/5 ring-1 ring-accent"
                                  : isDone
                                  ? "border-border bg-surface/90"
                                  : "border-border/60 bg-white/40 opacity-75"
                              )}
                            >
                              <div className="mb-1 flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  {isDone ? (
                                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                                  ) : isRunning ? (
                                    <RefreshCw className="h-4 w-4 text-accent animate-spin shrink-0" />
                                  ) : (
                                    <Clock className="h-4 w-4 text-muted/60 shrink-0" />
                                  )}
                                  <div className="font-medium text-ink text-sm">
                                    {stage.stage_index}. {formatStageKey(stage.stage_key, language)}
                                  </div>
                                </div>
                                <Badge label={formatStatus(stage.status, language)} tone={stage.status} />
                              </div>

                              <div className="flex items-center justify-between text-xs text-muted pt-1">
                                <span>
                                  {t.common.attempts}: {stage.attempt_count}
                                  {stage.failure_class
                                    ? ` · ${t.common.failureType}: ${formatFailureClass(stage.failure_class, language)}`
                                    : ""}
                                </span>
                                {hasOutput ? (
                                  <button
                                    onClick={() => viewArtifactForStage(stage.stage_key)}
                                    className="inline-flex items-center gap-1 font-semibold text-accent hover:underline text-xs"
                                  >
                                    View Output <ArrowRight className="h-3 w-3" />
                                  </button>
                                ) : null}
                              </div>

                              {stage.error_message ? (
                                <div className="mt-2 rounded-xl bg-danger/10 p-2 text-xs text-danger">
                                  {stage.error_message}
                                </div>
                              ) : null}
                            </div>
                          );
                        })}
                    </div>
                  </div>
                </div>
              </Card>

              {/* Real-time Feeds: Events, Logs, Citations */}
              <Card>
                <div className="mb-4 flex items-center justify-between border-b border-border pb-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setActiveFeedTab("events")}
                      className={cn(
                        "rounded-xl px-3 py-1.5 text-xs font-semibold transition",
                        activeFeedTab === "events"
                          ? "bg-accent text-white shadow-glow"
                          : "text-muted hover:bg-white"
                      )}
                    >
                      Events ({eventFeed.length})
                    </button>
                    <button
                      onClick={() => setActiveFeedTab("logs")}
                      className={cn(
                        "rounded-xl px-3 py-1.5 text-xs font-semibold transition",
                        activeFeedTab === "logs"
                          ? "bg-accent text-white shadow-glow"
                          : "text-muted hover:bg-white"
                      )}
                    >
                      Logs ({logFeed.length})
                    </button>
                    <button
                      onClick={() => setActiveFeedTab("citations")}
                      className={cn(
                        "rounded-xl px-3 py-1.5 text-xs font-semibold transition",
                        activeFeedTab === "citations"
                          ? "bg-accent text-white shadow-glow"
                          : "text-muted hover:bg-white"
                      )}
                    >
                      Citations ({citations.length})
                    </button>
                  </div>
                  <Badge label={isPending ? t.common.syncing : t.common.live} tone="active" />
                </div>

                {activeFeedTab === "events" ? (
                  <FeedColumn
                    title={t.pipeline.events}
                    items={eventFeed}
                    language={language}
                    emptyText={t.common.waitingEvents}
                  />
                ) : null}

                {activeFeedTab === "logs" ? (
                  <FeedColumn
                    title={t.pipeline.logs}
                    items={logFeed}
                    language={language}
                    emptyText={t.common.waitingEvents}
                  />
                ) : null}

                {activeFeedTab === "citations" ? (
                  <div className="rounded-[24px] border border-border bg-white/70 p-4">
                    <div className="mb-3 text-sm font-semibold text-ink flex items-center gap-2">
                      <BookOpen className="h-4 w-4 text-accent" /> Verified Literature Citations
                    </div>
                    <div className="max-h-[420px] space-y-2 overflow-auto">
                      {citations.length ? (
                        citations.map((cite) => (
                          <div key={cite.id} className="rounded-2xl border border-border/80 bg-surface px-3.5 py-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="font-serif text-sm font-semibold text-ink">{cite.title}</div>
                              <Badge label={cite.source} tone="neutral" />
                            </div>
                            <div className="mt-1 text-xs text-muted">
                              {cite.authors.join(", ") || "Unknown authors"} · {cite.year || "n.d."} · {cite.venue}
                            </div>
                            {cite.url ? (
                              <a
                                href={cite.url}
                                target="_blank"
                                rel="noreferrer"
                                className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
                              >
                                View Source <ExternalLink className="h-3 w-3" />
                              </a>
                            ) : null}
                          </div>
                        ))
                      ) : (
                        <div className="rounded-2xl border border-dashed border-border px-3 py-4 text-sm text-muted">
                          No verified citations captured yet for this run.
                        </div>
                      )}
                    </div>
                  </div>
                ) : null}

                {/* Budget Snapshot */}
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
                    <Metric label={t.pipeline.refreshState} value={selectedRun?.status || t.common.idle} />
                  </div>
                </div>
              </Card>
            </div>
          ) : null}

          {/* Pane 3: Research Chat */}
          {activePane === "chat" ? (
            <div className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
              <Card>
                <CardTitle
                  eyebrow={t.chat.eyebrow}
                  title={t.chat.title}
                  description={t.chat.description}
                />
                <div className="space-y-4">
                  <select
                    className="w-full rounded-2xl border border-border bg-white/80 px-4 py-3 text-sm font-medium"
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

                  <div className="space-y-2">
                    <div className="text-xs font-semibold uppercase tracking-wider text-muted">
                      Suggested Research Queries
                    </div>
                    <div className="flex flex-col gap-1.5">
                      {promptSuggestions.map((prompt, i) => (
                        <button
                          key={i}
                          onClick={() => sendChat(prompt)}
                          className="rounded-xl border border-border/80 bg-white/70 px-3 py-2 text-left text-xs font-medium text-ink hover:border-accent hover:bg-white transition flex items-center justify-between"
                        >
                          <span className="truncate">{prompt}</span>
                          <Sparkles className="h-3 w-3 shrink-0 text-accent ml-2" />
                        </button>
                      ))}
                    </div>
                  </div>

                  <Textarea
                    placeholder={t.chat.placeholder}
                    value={chatMessage}
                    onChange={(event) => setChatMessage(event.target.value)}
                    className="min-h-[140px]"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void sendChat();
                      }
                    }}
                  />
                  <Button onClick={() => sendChat()} disabled={!selectedProjectId || !chatMessage.trim() || isChatSending}>
                    {isChatSending ? (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Thinking...
                      </>
                    ) : (
                      <>
                        <Bot className="mr-2 h-4 w-4" /> {t.chat.send}
                      </>
                    )}
                  </Button>
                </div>
              </Card>

              {/* Continuous Conversation Stream */}
              <Card>
                <CardTitle
                  eyebrow="Interactive Dialogue"
                  title="Research Agent Dialogue"
                  description="Persistent conversational history grounded in experiment records and citations."
                />
                <div
                  ref={chatScrollRef}
                  className="max-h-[580px] min-h-[380px] space-y-3.5 overflow-y-auto rounded-[24px] border border-border bg-[#f8f4ec] p-5 font-mono text-sm leading-6"
                >
                  {chatMessages.length === 0 && !isChatSending ? (
                    <div className="flex h-64 flex-col items-center justify-center text-center text-muted">
                      <Bot className="mb-3 h-10 w-10 text-accent/40" />
                      <p className="font-serif text-lg text-ink">No conversation yet</p>
                      <p className="mt-1 text-xs">
                        Ask questions about objectives, literature, hypotheses, or experiment results.
                      </p>
                    </div>
                  ) : null}

                  {chatMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className={cn(
                        "rounded-2xl p-4 transition-all max-w-[85%]",
                        msg.role === "user"
                          ? "ml-auto bg-ink text-white"
                          : "mr-auto border border-border bg-white text-ink shadow-sm"
                      )}
                    >
                      <div className="mb-1.5 flex items-center justify-between gap-3 text-xs opacity-75">
                        <span className="font-semibold uppercase tracking-wider">
                          {msg.role === "user" ? "Researcher" : "Auto-Researcher"}
                        </span>
                        {msg.model_name ? (
                          <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[10px] text-accent">
                            {msg.model_name}
                            {msg.degraded ? " · template" : ""}
                          </span>
                        ) : null}
                      </div>
                      <div className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
                        {msg.content}
                      </div>
                    </div>
                  ))}

                  {isChatSending ? (
                    <div className="mr-auto flex items-center gap-2 rounded-2xl border border-border bg-white p-4 text-xs text-muted shadow-sm">
                      <RefreshCw className="h-3.5 w-3.5 animate-spin text-accent" />
                      <span>Auto-Researcher is synthesizing response...</span>
                    </div>
                  ) : null}
                </div>
              </Card>
            </div>
          ) : null}

          {/* Pane 4: Artifacts */}
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
                    className="w-full rounded-2xl border border-border bg-white/80 px-4 py-3 text-sm font-medium"
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

                  <div className="max-h-[520px] space-y-2 overflow-y-auto">
                    {artifacts.map((artifact) => {
                      const isSelected = artifactContent?.artifact.id === artifact.id;
                      return (
                        <div
                          key={artifact.id}
                          className={cn(
                            "flex items-center justify-between rounded-2xl border px-4 py-3 text-left transition",
                            isSelected
                              ? "border-accent bg-white shadow-sm"
                              : "border-border bg-white/75 hover:bg-white"
                          )}
                        >
                          <button
                            onClick={async () => setArtifactContent(await api.getArtifact(artifact.id))}
                            className="flex-1 text-left"
                          >
                            <div className="text-sm font-medium text-ink truncate max-w-[200px]">
                              {artifact.relative_path}
                            </div>
                            <div className="mt-0.5 text-xs text-muted">
                              {artifact.kind} · {Math.round(artifact.size_bytes / 1024) || 1} KB
                            </div>
                          </button>
                          <div className="flex items-center gap-2">
                            <Badge label={artifact.mime_type.split("/").pop() || t.common.file} />
                            <a
                              href={api.downloadArtifactUrl(artifact.id)}
                              download
                              title="Download artifact"
                              className="rounded-lg p-1.5 text-muted hover:bg-surface hover:text-ink transition"
                            >
                              <Download className="h-4 w-4" />
                            </a>
                          </div>
                        </div>
                      );
                    })}
                    {artifacts.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-border p-4 text-center text-sm text-muted">
                        No artifacts recorded for this run yet.
                      </div>
                    ) : null}
                  </div>
                </div>
              </Card>

              {/* Artifact Preview & Download */}
              <Card>
                <div className="mb-4 flex items-center justify-between border-b border-border pb-3">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wider text-accent">Artifact Preview</div>
                    <h3 className="font-serif text-xl font-bold text-ink">
                      {artifactContent?.artifact.relative_path || t.common.noArtifact}
                    </h3>
                  </div>
                  {artifactContent ? (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          void navigator.clipboard.writeText(artifactContent.content);
                          setCopiedArtifact(true);
                          setTimeout(() => setCopiedArtifact(false), 2000);
                        }}
                      >
                        {copiedArtifact ? (
                          <>
                            <Check className="mr-1.5 h-3.5 w-3.5 text-emerald-600" /> Copied
                          </>
                        ) : (
                          <>
                            <Copy className="mr-1.5 h-3.5 w-3.5" /> Copy Content
                          </>
                        )}
                      </Button>
                      <a
                        href={api.downloadArtifactUrl(artifactContent.artifact.id)}
                        download
                        className="inline-flex items-center gap-1.5 rounded-2xl bg-accent px-3 py-2 text-xs font-medium text-white shadow-glow transition hover:opacity-90"
                      >
                        <Download className="h-3.5 w-3.5" /> Download
                      </a>
                    </div>
                  ) : null}
                </div>

                <pre className="max-h-[640px] overflow-auto whitespace-pre-wrap rounded-[24px] border border-border bg-[#f8f4ec] p-5 font-mono text-xs leading-6 text-ink">
                  {artifactContent?.content || t.common.noArtifact}
                </pre>
              </Card>
            </div>
          ) : null}

          {/* Pane 5: Runs & Metrics */}
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
                        run.id === selectedRunId ? "border-accent bg-white shadow-sm" : "border-border bg-white/70 hover:bg-white"
                      )}
                    >
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <div className="font-serif text-xl text-ink truncate">{run.name}</div>
                        <Badge label={formatStatus(run.status, language)} tone={run.status} />
                      </div>
                      <div className="grid gap-2 sm:grid-cols-3">
                        <Metric label={t.runs.currentStage} value={formatStageKey(run.current_stage_key, language)} />
                        <Metric label={t.runs.retries} value={String(run.retry_count)} />
                        <Metric label={t.runs.cost} value={currency(run.total_cost_usd, locale)} />
                      </div>
                    </button>
                  ))}
                  {runs.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted">
                      No experiment runs found for this project.
                    </div>
                  ) : null}
                </div>
              </Card>

              {/* Run Snapshot & Execution Metrics */}
              <Card>
                <div className="mb-4 flex items-center justify-between border-b border-border pb-3">
                  <CardTitle
                    eyebrow={t.runs.snapshotEyebrow}
                    title={t.runs.snapshotTitle}
                    description={t.runs.snapshotDescription}
                  />
                  {selectedRun && ["failed", "stopped"].includes(selectedRun.status) ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleRetryRun(selectedRun.id)}
                      disabled={isRetrying}
                    >
                      <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Retry Run
                    </Button>
                  ) : null}
                </div>

                {selectedRun ? (
                  <div className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Metric label={t.runs.runId} value={selectedRun.id.slice(0, 12)} />
                      <Metric label={t.common.failureType} value={formatFailureClass(selectedRun.failure_class, language)} />
                      <Metric label={t.runs.stageCursor} value={`${selectedRun.stage_cursor} / 10 stages`} />
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
                        Latest Stage Execution Output Snapshot
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
      <div className="mt-1 text-sm font-medium text-ink truncate">{value}</div>
    </div>
  );
}
