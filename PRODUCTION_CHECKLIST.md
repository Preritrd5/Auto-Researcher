# Auto-Researcher: Production Launch Checklist

This checklist must be reviewed and signed off prior to promoting Auto-Researcher to a public production environment.

---

## 1. Security & Authentication Audit

- [ ] **Cryptographic Secret Key**: `AUTO_RESEARCHER_SECRET` is set to a freshly generated 64-character random string (not the default placeholder).
- [ ] **Cookie Protection**: Authentication cookies enforce `HttpOnly`, `SameSite=Lax`, and `Secure=True` (active when `AUTO_RESEARCHER_ENV=production`).
- [ ] **CORS Origin Whitelist**: `CORS_ORIGINS` explicitly lists only authorized frontend production domains (wildcard `*` disabled).
- [ ] **Path Traversal Protection**: Verified that `/api/artifacts/{id}/download` rejects directory traversal attempts (`..`, absolute paths outside artifacts root).
- [ ] **Multi-Tenant Data Isolation**: Verified that authenticated users can only access their own projects, runs, citations, and artifacts.
- [ ] **Brute-Force Rate Limiting**: In-memory login rate limiter blocks IP/email combinations after 5 consecutive failed login attempts for 15 minutes.
- [ ] **SQL Injection Prevention**: All database queries strictly utilize SQLAlchemy ORM with parameterized statements.
- [ ] **Public Variable Audit**: Verified that no database URLs, service keys, or private LLM tokens are prefixed with `NEXT_PUBLIC_` in the frontend.

---

## 2. Infrastructure & Hosting

- [ ] **Frontend Vercel Configuration**: `frontend/vercel.json` and root `vercel.json` configured with security headers and clean URLs.
- [ ] **Backend Containerization**: `backend/Dockerfile` builds cleanly, utilizes non-privileged user, and includes healthcheck probe.
- [ ] **Worker Process Persistence**: The research worker daemon (`worker.py`) is deployed on a persistent container service (not a serverless function).
- [ ] **Persistent Artifact Volume**: Artifacts root (`/app/artifacts`) is mapped to persistent block storage or cloud volume.
- [ ] **Database Engine**: Production database runs PostgreSQL 16 with the `pgvector` extension enabled.
- [ ] **Connection Pooling**: PostgreSQL connection pooling configured with `DB_POOL_SIZE=10`, `DB_MAX_OVERFLOW=20`, and `pool_pre_ping=True`.
- [ ] **Redis Pub/Sub Event Bus**: Redis 7.0+ instance configured with TLS (`rediss://`) and persistent append-only file (AOF).

---

## 3. Observability, Logging & Reliability

- [ ] **Health Endpoint Monitoring**: `/api/health` probes both FastAPI application state and PostgreSQL database connection.
- [ ] **Liveness & Readiness Probes**: `/api/health/live` and `/api/health/ready` hooked into container orchestrator restart triggers.
- [ ] **Error Masking**: Production exception handlers prevent raw Python stack traces from leaking to client responses.
- [ ] **Worker Lease Timeout**: `LEASE_SECONDS` configured to automatically re-queue stale runs in case of abrupt worker failure.
- [ ] **Continuous Integration**: GitHub Actions CI workflow successfully passes on `main` branch across backend, frontend, and Docker validation.

---

## 4. Disaster Recovery & Operations

- [ ] **Automated Database Backups**: Automated daily snapshots and point-in-time recovery (PITR) enabled on managed PostgreSQL.
- [ ] **Artifact Backup Schedule**: Persistent artifact volume mirrored offsite on a recurring schedule.
- [ ] **Disaster Recovery Runbook**: Documented restoration procedures tested and confirmed in `DATABASE_MIGRATION.md`.
