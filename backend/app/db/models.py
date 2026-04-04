from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from uuid import uuid4

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def new_id() -> str:
    return uuid4().hex


class Base(DeclarativeBase):
    pass


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=utcnow,
        onupdate=utcnow,
    )


class RunStatus(str, Enum):
    draft = "draft"
    queued = "queued"
    running = "running"
    completed = "completed"
    failed = "failed"
    stopped = "stopped"


class StageStatus(str, Enum):
    pending = "pending"
    running = "running"
    completed = "completed"
    failed = "failed"
    skipped = "skipped"
    degraded = "degraded"


class Project(Base, TimestampMixin):
    __tablename__ = "projects"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    name: Mapped[str] = mapped_column(String(160))
    slug: Mapped[str] = mapped_column(String(180), unique=True, index=True)
    description: Mapped[str] = mapped_column(Text, default="")
    objective: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(32), default="active")
    primary_model_profile_id: Mapped[str | None] = mapped_column(
        ForeignKey("model_profiles.id", ondelete="SET NULL"),
        nullable=True,
    )
    critic_model_profile_id: Mapped[str | None] = mapped_column(
        ForeignKey("model_profiles.id", ondelete="SET NULL"),
        nullable=True,
    )
    default_compute_target_id: Mapped[str | None] = mapped_column(
        ForeignKey("compute_targets.id", ondelete="SET NULL"),
        nullable=True,
    )
    settings: Mapped[dict] = mapped_column(JSON, default=dict)

    budget: Mapped["Budget | None"] = relationship(back_populates="project", uselist=False)
    runs: Mapped[list["Run"]] = relationship(back_populates="project")
    memories: Mapped[list["Memory"]] = relationship(back_populates="project")


class Budget(Base, TimestampMixin):
    __tablename__ = "budgets"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), unique=True)
    max_cost_usd: Mapped[float] = mapped_column(Float, default=50.0)
    max_runtime_minutes: Mapped[int] = mapped_column(Integer, default=360)
    max_tokens: Mapped[int] = mapped_column(Integer, default=2_000_000)
    spent_cost_usd: Mapped[float] = mapped_column(Float, default=0.0)
    spent_tokens: Mapped[int] = mapped_column(Integer, default=0)

    project: Mapped[Project] = relationship(back_populates="budget")


class ModelProfile(Base, TimestampMixin):
    __tablename__ = "model_profiles"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    name: Mapped[str] = mapped_column(String(160), unique=True)
    provider_kind: Mapped[str] = mapped_column(String(64))
    model_name: Mapped[str] = mapped_column(String(160))
    base_url: Mapped[str] = mapped_column(String(512), default="")
    api_key_env: Mapped[str] = mapped_column(String(128), default="")
    cli_command: Mapped[str] = mapped_column(Text, default="")
    capabilities: Mapped[dict] = mapped_column(JSON, default=dict)
    profile_metadata: Mapped[dict] = mapped_column("metadata", JSON, default=dict)
    active: Mapped[bool] = mapped_column(Boolean, default=True)


class ComputeTarget(Base, TimestampMixin):
    __tablename__ = "compute_targets"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    name: Mapped[str] = mapped_column(String(160), unique=True)
    kind: Mapped[str] = mapped_column(String(32))
    priority: Mapped[int] = mapped_column(Integer, default=100)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    config: Mapped[dict] = mapped_column(JSON, default=dict)
    last_heartbeat_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class Run(Base, TimestampMixin):
    __tablename__ = "runs"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(200))
    status: Mapped[str] = mapped_column(String(32), default=RunStatus.queued.value, index=True)
    current_stage_key: Mapped[str | None] = mapped_column(String(64), nullable=True)
    stage_cursor: Mapped[int] = mapped_column(Integer, default=0)
    input_prompt: Mapped[str] = mapped_column(Text, default="")
    context: Mapped[dict] = mapped_column(JSON, default=dict)
    retry_count: Mapped[int] = mapped_column(Integer, default=0)
    total_cost_usd: Mapped[float] = mapped_column(Float, default=0.0)
    total_tokens: Mapped[int] = mapped_column(Integer, default=0)
    failure_class: Mapped[str | None] = mapped_column(String(64), nullable=True)
    lease_owner: Mapped[str | None] = mapped_column(String(128), nullable=True)
    leased_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    heartbeat_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    project: Mapped[Project] = relationship(back_populates="runs")
    stages: Mapped[list["StageRecord"]] = relationship(back_populates="run", cascade="all, delete-orphan")
    tasks: Mapped[list["Task"]] = relationship(back_populates="run", cascade="all, delete-orphan")
    artifacts: Mapped[list["Artifact"]] = relationship(back_populates="run", cascade="all, delete-orphan")
    events: Mapped[list["Event"]] = relationship(back_populates="run", cascade="all, delete-orphan")
    citations: Mapped[list["Citation"]] = relationship(back_populates="run", cascade="all, delete-orphan")


class StageRecord(Base, TimestampMixin):
    __tablename__ = "stages"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    run_id: Mapped[str] = mapped_column(ForeignKey("runs.id", ondelete="CASCADE"), index=True)
    stage_key: Mapped[str] = mapped_column(String(64), index=True)
    stage_index: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(32), default=StageStatus.pending.value)
    attempt_count: Mapped[int] = mapped_column(Integer, default=0)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    error_message: Mapped[str] = mapped_column(Text, default="")
    failure_class: Mapped[str] = mapped_column(String(64), default="")
    input_snapshot: Mapped[dict] = mapped_column(JSON, default=dict)
    output_snapshot: Mapped[dict] = mapped_column(JSON, default=dict)

    run: Mapped[Run] = relationship(back_populates="stages")


class Task(Base, TimestampMixin):
    __tablename__ = "tasks"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    run_id: Mapped[str] = mapped_column(ForeignKey("runs.id", ondelete="CASCADE"), index=True)
    stage_id: Mapped[str | None] = mapped_column(ForeignKey("stages.id", ondelete="SET NULL"), nullable=True)
    role: Mapped[str] = mapped_column(String(64))
    status: Mapped[str] = mapped_column(String(32), default=StageStatus.pending.value)
    attempt_count: Mapped[int] = mapped_column(Integer, default=0)
    input_text: Mapped[str] = mapped_column(Text, default="")
    output_text: Mapped[str] = mapped_column(Text, default="")
    error_message: Mapped[str] = mapped_column(Text, default="")
    payload: Mapped[dict] = mapped_column(JSON, default=dict)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    run: Mapped[Run] = relationship(back_populates="tasks")


class Artifact(Base, TimestampMixin):
    __tablename__ = "artifacts"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    run_id: Mapped[str] = mapped_column(ForeignKey("runs.id", ondelete="CASCADE"), index=True)
    stage_id: Mapped[str | None] = mapped_column(ForeignKey("stages.id", ondelete="SET NULL"), nullable=True)
    kind: Mapped[str] = mapped_column(String(64))
    relative_path: Mapped[str] = mapped_column(String(512))
    mime_type: Mapped[str] = mapped_column(String(128), default="text/plain")
    checksum: Mapped[str] = mapped_column(String(128))
    size_bytes: Mapped[int] = mapped_column(Integer, default=0)
    artifact_metadata: Mapped[dict] = mapped_column("metadata", JSON, default=dict)

    run: Mapped[Run] = relationship(back_populates="artifacts")


class Event(Base, TimestampMixin):
    __tablename__ = "events"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    run_id: Mapped[str] = mapped_column(ForeignKey("runs.id", ondelete="CASCADE"), index=True)
    stage_id: Mapped[str | None] = mapped_column(ForeignKey("stages.id", ondelete="SET NULL"), nullable=True)
    level: Mapped[str] = mapped_column(String(24), default="info")
    event_type: Mapped[str] = mapped_column(String(64))
    message: Mapped[str] = mapped_column(Text)
    payload: Mapped[dict] = mapped_column(JSON, default=dict)

    run: Mapped[Run] = relationship(back_populates="events")


class Memory(Base, TimestampMixin):
    __tablename__ = "memories"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    run_id: Mapped[str | None] = mapped_column(ForeignKey("runs.id", ondelete="SET NULL"), nullable=True)
    category: Mapped[str] = mapped_column(String(64))
    content: Mapped[str] = mapped_column(Text)
    embedding: Mapped[list] = mapped_column(JSON, default=list)
    confidence: Mapped[float] = mapped_column(Float, default=0.5)
    memory_metadata: Mapped[dict] = mapped_column("metadata", JSON, default=dict)

    project: Mapped[Project] = relationship(back_populates="memories")


class Citation(Base, TimestampMixin):
    __tablename__ = "citations"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    run_id: Mapped[str] = mapped_column(ForeignKey("runs.id", ondelete="CASCADE"), index=True)
    stage_id: Mapped[str | None] = mapped_column(ForeignKey("stages.id", ondelete="SET NULL"), nullable=True)
    source: Mapped[str] = mapped_column(String(64))
    external_id: Mapped[str] = mapped_column(String(160), default="")
    title: Mapped[str] = mapped_column(Text)
    authors: Mapped[list] = mapped_column(JSON, default=list)
    year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    url: Mapped[str] = mapped_column(String(600), default="")
    doi: Mapped[str] = mapped_column(String(160), default="")
    venue: Mapped[str] = mapped_column(String(240), default="")
    verified: Mapped[bool] = mapped_column(Boolean, default=False)
    citation_metadata: Mapped[dict] = mapped_column("metadata", JSON, default=dict)

    run: Mapped[Run] = relationship(back_populates="citations")
