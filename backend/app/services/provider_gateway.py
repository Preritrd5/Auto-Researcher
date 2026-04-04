from __future__ import annotations

import json
import os
import subprocess
import time
from dataclasses import dataclass
from typing import Any

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import ModelProfile


@dataclass
class LLMResult:
    text: str
    model_name: str
    input_tokens: int = 0
    output_tokens: int = 0
    cost_usd: float = 0.0
    degraded: bool = False


class ProviderGateway:
    async def resolve_profile(self, session: AsyncSession, profile_id: str | None) -> ModelProfile | None:
        if not profile_id:
            return None
        return await session.get(ModelProfile, profile_id)

    async def test_profile(self, profile: ModelProfile, prompt: str = "ping") -> tuple[bool, str, int, str]:
        started = time.perf_counter()
        try:
            if profile.provider_kind == "cli_agent":
                result = self._run_cli(profile.cli_command, prompt)
                latency_ms = int((time.perf_counter() - started) * 1000)
                return True, "CLI agent reachable", latency_ms, result[:300]
            reply = await self.chat(profile, [{"role": "user", "content": prompt}])
            latency_ms = int((time.perf_counter() - started) * 1000)
            return True, "Provider reachable", latency_ms, reply.text[:300]
        except Exception as exc:
            latency_ms = int((time.perf_counter() - started) * 1000)
            return False, str(exc), latency_ms, ""

    async def chat(self, profile: ModelProfile, messages: list[dict[str, str]]) -> LLMResult:
        if profile.provider_kind == "anthropic_native":
            return await self._chat_anthropic(profile, messages)
        if profile.provider_kind in {"openai_native", "openai_compatible"}:
            return await self._chat_openai_compatible(profile, messages)
        if profile.provider_kind == "cli_agent":
            text = self._run_cli(profile.cli_command, messages[-1]["content"])
            return LLMResult(text=text, model_name=profile.model_name)
        raise ValueError(f"Unsupported provider kind: {profile.provider_kind}")

    async def _chat_openai_compatible(
        self,
        profile: ModelProfile,
        messages: list[dict[str, str]],
    ) -> LLMResult:
        api_key = self._resolve_api_key(profile)
        if not api_key:
            raise ValueError(f"Missing API key for profile '{profile.name}'")
        base_url = (profile.base_url or "https://api.openai.com/v1").rstrip("/")
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{base_url}/chat/completions",
                headers={"Authorization": f"Bearer {api_key}"},
                json={"model": profile.model_name, "messages": messages, "temperature": 0.3},
            )
            response.raise_for_status()
            payload = response.json()
            text = payload["choices"][0]["message"]["content"]
            usage = payload.get("usage") or {}
            return LLMResult(
                text=text,
                model_name=profile.model_name,
                input_tokens=usage.get("prompt_tokens", 0),
                output_tokens=usage.get("completion_tokens", 0),
            )

    async def _chat_anthropic(
        self,
        profile: ModelProfile,
        messages: list[dict[str, str]],
    ) -> LLMResult:
        api_key = self._resolve_api_key(profile)
        if not api_key:
            raise ValueError(f"Missing API key for profile '{profile.name}'")
        base_url = (profile.base_url or "https://api.anthropic.com").rstrip("/")
        system = "\n".join(msg["content"] for msg in messages if msg["role"] == "system")
        anthropic_messages = [
            {"role": msg["role"], "content": msg["content"]}
            for msg in messages
            if msg["role"] != "system"
        ]
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{base_url}/v1/messages",
                headers={
                    "x-api-key": api_key,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json",
                },
                json={
                    "model": profile.model_name,
                    "max_tokens": 2048,
                    "system": system,
                    "messages": anthropic_messages,
                },
            )
            response.raise_for_status()
            payload = response.json()
            blocks = payload.get("content") or []
            text = "\n".join(block.get("text", "") for block in blocks if block.get("type") == "text")
            usage = payload.get("usage") or {}
            return LLMResult(
                text=text,
                model_name=profile.model_name,
                input_tokens=usage.get("input_tokens", 0),
                output_tokens=usage.get("output_tokens", 0),
            )

    def _run_cli(self, cli_command: str, prompt: str) -> str:
        if not cli_command.strip():
            raise ValueError("CLI agent profile requires cli_command")
        completed = subprocess.run(
            cli_command,
            input=prompt,
            text=True,
            shell=True,
            capture_output=True,
            check=False,
            timeout=120,
        )
        if completed.returncode != 0:
            raise RuntimeError(completed.stderr.strip() or "CLI agent command failed")
        return completed.stdout.strip()

    def _resolve_api_key(self, profile: ModelProfile) -> str:
        if profile.profile_metadata.get("api_key"):
            return str(profile.profile_metadata["api_key"])
        if profile.api_key_env:
            return os.environ.get(profile.api_key_env, "")
        return ""

    def parse_json(self, text: str, fallback: Any) -> Any:
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            return fallback
