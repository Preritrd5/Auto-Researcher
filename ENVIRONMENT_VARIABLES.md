# Auto-Researcher: Environment Variables Reference

This document provides a comprehensive reference of all environment variables supported by the Auto-Researcher platform across frontend, backend, database, worker daemon, and external AI integrations.

---

## 1. Application & Server Environment

| Variable | Type | Default | Required in Production | Description |
| :--- | :--- | :--- | :--- | :--- |
| `AUTO_RESEARCHER_ENV` | String | `development` | Yes | Specifies application lifecycle mode. Options: `development`, `staging`, `production`. In `production`, secure cookies are enforced, stack traces are masked, and strict CORS rules apply. |
| `AUTO_RESEARCHER_SECRET` | String | `please-change-this-secret` | **Yes (Critical)** | Secret key used for signing HS256 JWT authentication tokens. In production, this **must** be a cryptographically secure random string with at least 256 bits of entropy. |
| `LOG_LEVEL` | String | `INFO` | No | Logging verbosity. Options: `DEBUG`, `INFO`, `WARNING`, `ERROR`, `CRITICAL`. |
| `CORS_ORIGINS` | String / Array | `http://localhost:3000,http://127.0.0.1:3000` | **Yes** | Comma-separated list or JSON array of allowed origins for cross-origin resource sharing (CORS). Must match the public domain of your frontend deployment. |

> [!CAUTION]
> If `AUTO_RESEARCHER_ENV=production` and `AUTO_RESEARCHER_SECRET` is left as default, the backend will log a severe security warning. Never deploy with default secrets.

---

## 2. Database & Connection Pooling

| Variable | Type | Default | Required in Production | Description |
| :--- | :--- | :--- | :--- | :--- |
| `DATABASE_URL` | String | `sqlite+aiosqlite:///./auto_researcher.db` | **Yes** | SQLAlchemy connection URI. In production, must use `postgresql+asyncpg://<user>:<pass>@<host>:<port>/<db>`. Supports SSL query params (e.g. `?ssl=require`). |
| `DB_POOL_SIZE` | Integer | `10` | No | Number of persistent connections kept open in the SQLAlchemy async connection pool (PostgreSQL only). |
| `DB_MAX_OVERFLOW` | Integer | `20` | No | Maximum number of additional temporary connections permitted beyond `DB_POOL_SIZE` during traffic bursts. |
| `DB_POOL_RECYCLE` | Integer | `300` | No | Seconds after which idle database connections are refreshed to avoid stale connection drops by cloud firewalls or proxies. |
| `POSTGRES_DB` | String | `auto_researcher` | Docker only | PostgreSQL database name used by Docker Compose. |
| `POSTGRES_USER` | String | `auto_researcher` | Docker only | PostgreSQL database user used by Docker Compose. |
| `POSTGRES_PASSWORD` | String | `auto_researcher_prod_pass` | Docker only | PostgreSQL user password used by Docker Compose. |

---

## 3. Realtime Cache & Event Bus

| Variable | Type | Default | Required in Production | Description |
| :--- | :--- | :--- | :--- | :--- |
| `REDIS_URL` | String | `redis://localhost:6379/0` | Recommended | Redis connection URI for real-time WebSocket pub/sub streaming between backend services and workers. Supports TLS `rediss://`. If Redis is unavailable, the system automatically falls back to database event logging and HTTP polling. |

---

## 4. File Storage & Artifact Management

| Variable | Type | Default | Required in Production | Description |
| :--- | :--- | :--- | :--- | :--- |
| `ARTIFACTS_ROOT` | String / Path | `../artifacts` | Yes (Volume Mount) | Local filesystem directory path where generated research papers, proposals, experimental code, and execution metrics are persisted. Must be mounted to a persistent volume in container environments. |

---

## 5. Research Engine & Worker Leases

| Variable | Type | Default | Required in Production | Description |
| :--- | :--- | :--- | :--- | :--- |
| `LEASE_SECONDS` | Integer | `90` | No | Duration in seconds that an active worker holds an exclusive lock on an executing research run before renewal or failover. |
| `WORKER_POLL_SECONDS` | Integer | `3` | No | Frequency in seconds that the `worker.py` daemon polls the database for newly queued research runs. |
| `MAX_STAGE_RETRIES` | Integer | `3` | No | Maximum automated retry attempts for a failed pipeline stage before declaring the run failed. |

---

## 6. AI Model Providers & Academic Search APIs

| Variable | Type | Default | Required in Production | Description |
| :--- | :--- | :--- | :--- | :--- |
| `OPENAI_API_KEY` | String | `""` | Optional | API key for OpenAI models (GPT-4o, o1, o3-mini). |
| `ANTHROPIC_API_KEY` | String | `""` | Optional | API key for Anthropic models (Claude 3.5 Sonnet, Claude 3.7). |
| `DEEPSEEK_API_KEY` | String | `""` | Optional | API key for DeepSeek models (DeepSeek-V3, DeepSeek-R1). |
| `QWEN_API_KEY` | String | `""` | Optional | API key for Alibaba Cloud DashScope / Qwen models. |
| `SEMANTIC_SCHOLAR_API_KEY` | String | `""` | Optional | API key for Semantic Scholar Academic Graph API. Unauthenticated requests are allowed with baseline rate limits; this key provides higher throughput. |

---

## 7. Frontend Client Environment (Next.js)

These variables are consumed by the Next.js frontend application during build and runtime:

| Variable | Type | Default | Required in Production | Description |
| :--- | :--- | :--- | :--- | :--- |
| `NEXT_PUBLIC_API_BASE_URL` | String | `http://localhost:8000` | **Yes (Vercel)** | Public HTTP(S) URL of the backend API server. Consumed by the browser client to execute API calls. Example: `https://api.yourdomain.com`. |
| `NEXT_PUBLIC_WS_BASE_URL` | String | `ws://localhost:8000` | **Yes (Vercel)** | Public WS(S) URL of the backend WebSocket gateway. Consumed by the browser client for real-time stage execution streaming. Example: `wss://api.yourdomain.com`. |

> [!IMPORTANT]
> Never prefix sensitive secrets (e.g. `DATABASE_URL` or `OPENAI_API_KEY`) with `NEXT_PUBLIC_`. In Next.js, all `NEXT_PUBLIC_` variables are inlined into public JavaScript bundles sent to the browser.
