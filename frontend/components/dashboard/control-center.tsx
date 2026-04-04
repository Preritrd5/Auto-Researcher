"use client";

import { Activity, Bot, FileText, FolderKanban, Play, RadioTower, Wallet } from "lucide-react";
import { useEffect, useState, useTransition } from "react";

import { Artifact, ArtifactContent, BusEvent, ComputeTarget, ModelProfile, Project, Run } from "@/lib/types";
import { api } from "@/lib/api";
import { currency, wsUrl } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";

type Pane = "setup" | "pipeline" | "chat" | "artifacts" | "runs";

const paneList: Array<{ key: Pane; label: string; icon: typeof FolderKanban }> = [
  { key: "setup", label: "项目设置", icon: FolderKanban },
  { key: "pipeline", label: "实时流程看板", icon: Activity },
  { key: "chat", label: "研究对话", icon: Bot },
  { key: "artifacts", label: "成果产物", icon: FileText },
  { key: "runs", label: "运行与指标", icon: Wallet }
];

const statusLabelMap: Record<string, string> = {
  completed: "已完成",
  running: "运行中",
  queued: "排队中",
  failed: "失败",
  stopped: "已停止",
  pending: "待执行",
  active: "启用中"
};

const stageLabelMap: Record<string, string> = {
  brief_intake: "研究简报录入",
  literature_scan: "文献扫描",
  idea_generation: "想法生成",
  novelty_feasibility_ranking: "创新性与可行性排序",
  proposal_drafting: "Proposal 起草",
  experiment_planning: "实验规划",
  code_generation: "代码生成",
  experiment_run_refine_loop: "实验执行与修复循环",
  analysis_result_to_claim: "结果分析与结论判断",
  paper_drafting_review_export: "论文写作、审阅与导出"
};

const failureClassLabelMap: Record<string, string> = {
  tooling: "工具问题",
  code: "代码问题",
  data: "数据问题",
  resource: "资源问题",
  reasoning: "推理问题",
  citation: "引用问题",
  infra: "基础设施问题"
};

const eventTypeLabelMap: Record<string, string> = {
  "run.completed": "运行完成",
  "stage.started": "阶段开始",
  "stage.completed": "阶段完成",
  "stage.failed": "阶段失败",
  log: "日志",
  "bus.degraded": "事件总线降级"
};

function formatStatus(status?: string | null) {
  if (!status) return "未知";
  return statusLabelMap[status] || status;
}

function formatStageKey(stageKey?: string | null) {
  if (!stageKey) return "空闲";
  return stageLabelMap[stageKey] || stageKey.replaceAll("_", " ");
}

function formatFailureClass(failureClass?: string | null) {
  if (!failureClass) return "无";
  return failureClassLabelMap[failureClass] || failureClass;
}

function formatEventType(eventType?: string | null) {
  if (!eventType) return "事件";
  return eventTypeLabelMap[eventType] || eventType;
}

function formatEventMessage(event: BusEvent) {
  const stageKey = typeof event.payload?.stage_key === "string" ? event.payload.stage_key : null;
  const stageLabel = stageKey ? formatStageKey(stageKey) : null;

  if (event.event_type === "run.completed") {
    return "运行已完成";
  }

  if (event.event_type === "stage.started" && stageLabel) {
    return `${stageLabel}已开始`;
  }

  if (event.event_type === "stage.completed" && stageLabel) {
    return `${stageLabel}已完成`;
  }

  if (event.event_type === "log" && stageLabel && event.message.endsWith(": completed")) {
    return `${stageLabel}：已完成`;
  }

  if (event.event_type === "stage.failed" && stageLabel) {
    return `${stageLabel}失败：${event.message}`;
  }

  return event.message;
}

export function ControlCenter() {
  const [activePane, setActivePane] = useState<Pane>("setup");
  const [projects, setProjects] = useState<Project[]>([]);
  const [profiles, setProfiles] = useState<ModelProfile[]>([]);
  const [computeTargets, setComputeTargets] = useState<ComputeTarget[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [selectedRunId, setSelectedRunId] = useState<string>("");
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [artifactContent, setArtifactContent] = useState<ArtifactContent | null>(null);
  const [chatReply, setChatReply] = useState("");
  const [eventFeed, setEventFeed] = useState<BusEvent[]>([]);
  const [logFeed, setLogFeed] = useState<BusEvent[]>([]);
  const [isPending, startTransition] = useTransition();

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
  const [providerTest, setProviderTest] = useState("");

  useEffect(() => {
    void refreshAll();
  }, []);

  useEffect(() => {
    if (!selectedProjectId && projects[0]) {
      setSelectedProjectId(projects[0].id);
    }
  }, [projects, selectedProjectId]);

  useEffect(() => {
    if (selectedProjectId) {
      void api.listRuns(selectedProjectId).then((nextRuns) => {
        setRuns(nextRuns);
        if (!selectedRunId && nextRuns[0]) {
          setSelectedRunId(nextRuns[0].id);
        }
      });
    }
  }, [selectedProjectId, selectedRunId]);

  useEffect(() => {
    if (!selectedRunId) return;
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
      name: runForm.name || `运行 ${new Date().toLocaleTimeString("zh-CN")}`,
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
    setChatReply(
      `${response.reply}\n\n（模型：${response.model_name}${response.degraded ? "，降级模式" : ""}）`
    );
    setChatMessage("");
  }

  async function testProfile(profileId: string) {
    const response = await api.testProvider({ profile_id: profileId, prompt: "Say provider ok." });
    setProviderTest(
      `${response.ok ? "通过" : "失败"} · ${response.message}${response.sample ? ` · ${response.sample}` : ""}`
    );
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
            <h1 className="font-serif text-4xl leading-none text-ink">自动科研控制台</h1>
            <p className="mt-4 text-sm leading-6 text-muted">
              面向单用户自托管的全流程自动科研平台，覆盖 idea、proposal、experiment、analysis 到 paper。
            </p>
          </div>

          <div className="space-y-2">
            {paneList.map((pane) => {
              const Icon = pane.icon;
              const active = activePane === pane.key;
              return (
                <button
                  key={pane.key}
                  onClick={() => setActivePane(pane.key)}
                  className={`flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left transition ${
                    active ? "bg-accent text-white shadow-glow" : "bg-white/60 text-ink hover:bg-white"
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <Icon className="h-4 w-4" />
                    <span className="text-sm font-medium">{pane.label}</span>
                  </span>
                  {pane.key === "pipeline" && selectedRun ? (
                    <Badge label={formatStatus(selectedRun.status)} tone={selectedRun.status} />
                  ) : null}
                </button>
              );
            })}
          </div>

          <div className="mt-8 rounded-3xl border border-border bg-white/70 p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink">
              <RadioTower className="h-4 w-4 text-accent" />
              实时状态
            </div>
            <div className="space-y-3 text-sm text-muted">
              <div>
                <div className="text-xs uppercase tracking-[0.16em]">项目</div>
                <div className="mt-1 text-ink">{selectedProject?.name || "未选择"}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-[0.16em]">运行</div>
                <div className="mt-1 text-ink">{selectedRun?.name || "暂无活跃运行"}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-[0.16em]">已用预算</div>
                <div className="mt-1 text-ink">{currency(topBudget?.spent_cost_usd || 0)}</div>
              </div>
            </div>
          </div>
        </Card>

        <div className="space-y-5">
          {activePane === "setup" ? (
            <div className="grid gap-5 xl:grid-cols-3">
              <Card>
                <CardTitle
                  eyebrow="步骤 1"
                  title="项目设置"
                  description="定义研究目标、默认模型、默认算力目标与预算上限。"
                />
                <div className="space-y-3">
                  <Input
                    placeholder="项目名称"
                    value={projectForm.name}
                    onChange={(event) => setProjectForm({ ...projectForm, name: event.target.value })}
                  />
                  <Textarea
                    placeholder="问题描述"
                    value={projectForm.description}
                    onChange={(event) => setProjectForm({ ...projectForm, description: event.target.value })}
                  />
                  <Textarea
                    placeholder="研究目标与成功标准"
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
                    <option value="">主执行模型配置</option>
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
                    <option value="">批判模型配置</option>
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
                    <option value="">默认算力目标</option>
                    {computeTargets.map((target) => (
                      <option key={target.id} value={target.id}>
                        {target.name}
                      </option>
                    ))}
                  </select>
                  <Button onClick={submitProject} disabled={!projectForm.name.trim()}>
                    创建项目
                  </Button>
                </div>
              </Card>

              <Card>
                <CardTitle
                  eyebrow="步骤 2"
                  title="模型配置"
                  description="登记 Anthropic、OpenAI、OpenAI-compatible 或 CLI-agent 后端。"
                />
                <div className="space-y-3">
                  <Input
                    placeholder="配置名称"
                    value={profileForm.name}
                    onChange={(event) => setProfileForm({ ...profileForm, name: event.target.value })}
                  />
                  <select
                    className="w-full rounded-2xl border border-border bg-white/80 px-4 py-3 text-sm"
                    value={profileForm.provider_kind}
                    onChange={(event) => setProfileForm({ ...profileForm, provider_kind: event.target.value })}
                  >
                    <option value="openai_compatible">openai_compatible（兼容 OpenAI 协议）</option>
                    <option value="openai_native">openai_native（OpenAI 原生）</option>
                    <option value="anthropic_native">anthropic_native（Anthropic 原生）</option>
                    <option value="cli_agent">cli_agent（命令行代理）</option>
                  </select>
                  <Input
                    placeholder="模型名"
                    value={profileForm.model_name}
                    onChange={(event) => setProfileForm({ ...profileForm, model_name: event.target.value })}
                  />
                  <Input
                    placeholder="Base URL"
                    value={profileForm.base_url}
                    onChange={(event) => setProfileForm({ ...profileForm, base_url: event.target.value })}
                  />
                  <Input
                    placeholder="API Key 环境变量名"
                    value={profileForm.api_key_env}
                    onChange={(event) => setProfileForm({ ...profileForm, api_key_env: event.target.value })}
                  />
                  <Input
                    placeholder="CLI 命令（可选）"
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
                      保存配置
                    </Button>
                    {profiles[0] ? (
                      <Button variant="secondary" onClick={() => void testProfile(profiles[0].id)}>
                        测试最近配置
                      </Button>
                    ) : null}
                  </div>
                  {providerTest ? (
                    <div className="rounded-2xl bg-white/80 px-4 py-3 text-sm text-muted">{providerTest}</div>
                  ) : null}
                </div>
              </Card>

              <Card>
                <CardTitle
                  eyebrow="步骤 3"
                  title="算力目标"
                  description="本机、Docker 和 SSH GPU 统一走同一套编排契约。"
                />
                <div className="space-y-3">
                  <Input
                    placeholder="目标名称"
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
                    placeholder="优先级"
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
                    保存目标
                  </Button>
                </div>
              </Card>

              <Card className="xl:col-span-3">
                <CardTitle
                  eyebrow="资源总览"
                  title="已配置资源"
                  description="控制面保持透明，没有隐藏队列、隐藏模型配置或隐藏算力目标。"
                />
                <div className="grid gap-4 md:grid-cols-3">
                  <InventoryBlock
                    title="项目"
                    items={projects.map((project) => ({
                      title: project.name,
                      subtitle: project.objective || project.description || "暂未填写研究目标",
                      action: () => {
                        setSelectedProjectId(project.id);
                        setActivePane("pipeline");
                      }
                    }))}
                  />
                  <InventoryBlock
                    title="模型配置"
                    items={profiles.map((profile) => ({
                      title: profile.name,
                      subtitle: `${profile.provider_kind} · ${profile.model_name}`,
                      action: () => void testProfile(profile.id)
                    }))}
                  />
                  <InventoryBlock
                    title="算力目标"
                    items={computeTargets.map((target) => ({
                      title: target.name,
                      subtitle: `${target.kind} · 优先级 ${target.priority}`
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
                  eyebrow="启动"
                  title="实时流程看板"
                  description="创建运行、接收状态流式更新，并查看持久化阶段状态机。"
                />
                <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
                  <div className="space-y-3">
                    <select
                      className="w-full rounded-2xl border border-border bg-white/80 px-4 py-3 text-sm"
                      value={selectedProjectId}
                      onChange={(event) => setSelectedProjectId(event.target.value)}
                    >
                      <option value="">选择项目</option>
                      {projects.map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.name}
                        </option>
                      ))}
                    </select>
                    <Input
                      placeholder="运行名称"
                      value={runForm.name}
                      onChange={(event) => setRunForm({ ...runForm, name: event.target.value })}
                    />
                    <Textarea
                      placeholder="运行提示词、简报补充或操作备注"
                      value={runForm.input_prompt}
                      onChange={(event) => setRunForm({ ...runForm, input_prompt: event.target.value })}
                      className="min-h-[140px]"
                    />
                    <div className="flex gap-3">
                      <Button onClick={launchRun} disabled={!selectedProjectId}>
                        <Play className="mr-2 h-4 w-4" />
                        启动运行
                      </Button>
                      {selectedRun ? (
                        <Button variant="danger" onClick={() => void api.stopRun(selectedRun.id)}>
                          停止
                        </Button>
                      ) : null}
                    </div>
                  </div>

                  <div className="rounded-[24px] border border-border bg-white/70 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <div>
                        <div className="text-xs uppercase tracking-[0.18em] text-muted">当前运行</div>
                        <div className="mt-1 font-serif text-2xl">{selectedRun?.name || "未选择运行"}</div>
                      </div>
                      {selectedRun ? <Badge label={formatStatus(selectedRun.status)} tone={selectedRun.status} /> : null}
                    </div>
                    <div className="space-y-3">
                      {(selectedRun?.stages || []).sort((left, right) => left.stage_index - right.stage_index).map((stage) => (
                        <div
                          key={stage.id}
                          className="rounded-2xl border border-border bg-surface/90 px-4 py-3"
                        >
                          <div className="mb-2 flex items-center justify-between gap-3">
                            <div>
                              <div className="text-xs uppercase tracking-[0.14em] text-muted">
                                阶段 {stage.stage_index}
                              </div>
                              <div className="font-medium text-ink">{formatStageKey(stage.stage_key)}</div>
                            </div>
                            <Badge label={formatStatus(stage.status)} tone={stage.status} />
                          </div>
                          <div className="text-sm text-muted">
                            尝试次数：{stage.attempt_count}
                            {stage.failure_class ? ` · 失败类型：${formatFailureClass(stage.failure_class)}` : ""}
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
                  eyebrow="实时"
                  title="事件与日志"
                  description="API 与 worker 通过 WebSocket 推送阶段事件和执行日志。"
                />
                <div className="grid gap-4 lg:grid-cols-2">
                  <FeedColumn title="事件" items={eventFeed} />
                  <FeedColumn title="日志" items={logFeed} />
                </div>
                <div className="mt-4 rounded-3xl border border-border bg-white/70 p-4">
                  <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink">
                    <Wallet className="h-4 w-4 text-accent" />
                    预算快照
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <Metric label="已用成本" value={currency(topBudget?.spent_cost_usd || 0)} />
                    <Metric label="Token 预算" value={`${topBudget?.spent_tokens || 0} / ${topBudget?.max_tokens || 0}`} />
                    <Metric label="刷新状态" value={isPending ? "同步中..." : "实时"} />
                  </div>
                </div>
              </Card>
            </div>
          ) : null}

          {activePane === "chat" ? (
            <div className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
              <Card>
                <CardTitle
                  eyebrow="上下文"
                  title="研究对话"
                  description="聊天窗口是控制面，不是事实来源。它用于引导流程，而不是替代 run 产物。"
                />
                <div className="space-y-3">
                  <select
                    className="w-full rounded-2xl border border-border bg-white/80 px-4 py-3 text-sm"
                    value={selectedProjectId}
                    onChange={(event) => setSelectedProjectId(event.target.value)}
                  >
                    <option value="">选择项目</option>
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                  <Textarea
                    placeholder="例如：更新研究策略、分析缺口、建议下一组实验，或细化 proposal。"
                    value={chatMessage}
                    onChange={(event) => setChatMessage(event.target.value)}
                    className="min-h-[240px]"
                  />
                  <Button onClick={sendChat} disabled={!selectedProjectId || !chatMessage.trim()}>
                    发送给研究副驾
                  </Button>
                </div>
              </Card>
              <Card>
                <CardTitle
                  eyebrow="回复"
                  title="模型响应"
                  description="有可用记忆时会基于近期上下文回答；若未配置主模型，则回退到模板模式。"
                />
                <pre className="max-h-[520px] overflow-auto rounded-[24px] border border-border bg-[#f8f4ec] p-5 font-mono text-sm leading-6 text-ink whitespace-pre-wrap">
                  {chatReply || "暂无响应。"}
                </pre>
              </Card>
            </div>
          ) : null}

          {activePane === "artifacts" ? (
            <div className="grid gap-5 xl:grid-cols-[0.75fr_1.25fr]">
              <Card>
                <CardTitle
                  eyebrow="输出"
                  title="成果产物"
                  description="产物元数据保存在数据库里，但事实文件仍保存在对应 run 目录中。"
                />
                <div className="space-y-3">
                  <select
                    className="w-full rounded-2xl border border-border bg-white/80 px-4 py-3 text-sm"
                    value={selectedRunId}
                    onChange={(event) => setSelectedRunId(event.target.value)}
                  >
                    <option value="">选择运行</option>
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
                        <Badge label={artifact.mime_type.split("/").pop() || "file"} />
                      </button>
                    ))}
                  </div>
                </div>
              </Card>
              <Card>
                <CardTitle
                  eyebrow="预览"
                  title={artifactContent?.artifact.relative_path || "请选择一个产物"}
                  description="长文本会在面板内直接展示，方便你审阅 proposal、plan、metrics 和 paper 输出。"
                />
                <pre className="max-h-[640px] overflow-auto rounded-[24px] border border-border bg-[#f8f4ec] p-5 font-mono text-sm leading-6 text-ink whitespace-pre-wrap">
                  {artifactContent?.content || "尚未选择产物。"}
                </pre>
              </Card>
            </div>
          ) : null}

          {activePane === "runs" ? (
            <div className="grid gap-5 xl:grid-cols-[1fr_0.9fr]">
              <Card>
                <CardTitle
                  eyebrow="历史"
                  title="运行与指标"
                  description="每一次运行都可回看，阶段状态、成本和最新指标都会集中展示。"
                />
                <div className="space-y-3">
                  {runs.map((run) => (
                    <button
                      key={run.id}
                      onClick={() => setSelectedRunId(run.id)}
                      className={`w-full rounded-[24px] border px-5 py-4 text-left transition ${
                        run.id === selectedRunId ? "border-accent bg-white" : "border-border bg-white/70 hover:bg-white"
                      }`}
                    >
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <div className="font-serif text-xl text-ink">{run.name}</div>
                        <Badge label={formatStatus(run.status)} tone={run.status} />
                      </div>
                      <div className="grid gap-2 sm:grid-cols-3">
                        <Metric label="当前阶段" value={formatStageKey(run.current_stage_key)} />
                        <Metric label="重试次数" value={String(run.retry_count)} />
                        <Metric label="成本" value={currency(run.total_cost_usd)} />
                      </div>
                    </button>
                  ))}
                </div>
              </Card>
              <Card>
                <CardTitle
                  eyebrow="快照"
                  title="当前选中运行"
                  description="指标与阶段摘要都来自持久化 run 状态和产物元数据。"
                />
                {selectedRun ? (
                  <div className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Metric label="运行 ID" value={selectedRun.id.slice(0, 8)} />
                      <Metric label="失败类型" value={formatFailureClass(selectedRun.failure_class)} />
                      <Metric label="阶段游标" value={String(selectedRun.stage_cursor)} />
                      <Metric label="Tokens" value={String(selectedRun.total_tokens)} />
                    </div>
                    <div className="rounded-[24px] border border-border bg-white/70 p-4">
                      <div className="mb-2 text-xs uppercase tracking-[0.16em] text-muted">提示词</div>
                      <div className="text-sm leading-6 text-ink">
                        {selectedRun.input_prompt || "该运行创建时未填写显式操作提示词。"}
                      </div>
                    </div>
                    <div className="rounded-[24px] border border-border bg-white/70 p-4">
                      <div className="mb-2 text-xs uppercase tracking-[0.16em] text-muted">最新阶段输出</div>
                      <pre className="max-h-[280px] overflow-auto font-mono text-xs leading-6 text-ink whitespace-pre-wrap">
                        {JSON.stringify(selectedRun.stages[selectedRun.stages.length - 1]?.output_snapshot || {}, null, 2)}
                      </pre>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-[24px] border border-dashed border-border bg-white/60 p-6 text-sm text-muted">
                    请先在左侧选择一个运行，再查看它的持久化状态。
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
  items
}: {
  title: string;
  items: Array<{ title: string; subtitle: string; action?: () => void }>;
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
            还没有任何配置。
          </div>
        )}
      </div>
    </div>
  );
}

function FeedColumn({
  title,
  items
}: {
  title: string;
  items: BusEvent[];
}) {
  return (
    <div className="rounded-[24px] border border-border bg-white/70 p-4">
      <div className="mb-3 text-sm font-semibold text-ink">{title}</div>
      <div className="max-h-[420px] space-y-2 overflow-auto">
        {items.length ? (
          items.map((item, index) => (
            <div key={`${title}-${index}`} className="rounded-2xl bg-surface px-3 py-3">
              <div className="text-xs uppercase tracking-[0.16em] text-muted">{formatEventType(item.event_type)}</div>
              <div className="mt-1 text-sm text-ink">{formatEventMessage(item)}</div>
            </div>
          ))
        ) : (
          <div className="rounded-2xl border border-dashed border-border px-3 py-4 text-sm text-muted">
            正在等待 WebSocket 事件流。
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
