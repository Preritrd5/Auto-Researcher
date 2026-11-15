# Auto-Researcher: Production Deployment Guide

This guide details the complete production architecture, cloud provisioning steps, container orchestration, and verification procedures for deploying **Auto-Researcher** to enterprise cloud infrastructure.

---

## 1. Production Architecture Overview

Auto-Researcher is architected with a strict separation between client-facing stateless services and stateful, compute-intensive autonomous research workers:

```
                          ┌───────────────────────────┐
                          │       Browser / User      │
                          └─────────────┬─────────────┘
                                        │ HTTPS / WSS
                                        ▼
                          ┌───────────────────────────┐
                          │   Frontend: Vercel CDN    │
                          │   (Next.js 15 App Router) │
                          └─────────────┬─────────────┘
                                        │ HTTPS (REST) / WSS
                                        ▼
                          ┌───────────────────────────┐
                          │   Backend: FastAPI App    │
                          │  (Docker / Railway / ECS) │
                          └──────┬──────────────┬─────┘
                                 │              │
                   SQL (asyncpg) │              │ Pub/Sub (Redis)
                                 ▼              ▼
           ┌───────────────────────────┐  ┌───────────────────────────┐
           │ Managed PostgreSQL (v16)  │  │   Managed Redis Cache     │
           │ (Supabase / Neon / RDS)   │  │ (Upstash / Railway Redis) │
           └─────────────┬─────────────┘  └─────────────┬─────────────┘
                         │                              │
                         └──────────────┬───────────────┘
                                        │ Leases & Events
                                        ▼
                          ┌───────────────────────────┐
                          │  Research Worker Daemon   │
                          │  (worker.py / Container)  │
                          └──────┬──────────────┬─────┘
                                 │              │
                 Sandboxed Run   │              │ Artifact Writes
                                 ▼              ▼
                    ┌──────────────────┐  ┌───────────────────────────┐
                    │ Python Execution │  │ Persistent Artifact Store │
                    │ Sandbox Subproc  │  │ (EFS / S3 / Mount Vol)     │
                    └──────────────────┘  └───────────────────────────┘
```

### Why Backend & Workers Require Persistent Hosting
- **Serverless Incompatibility**: Serverless functions (e.g. AWS Lambda, Vercel Functions) enforce hard timeout limits (typically 10–60 seconds). Auto-Researcher's autonomous pipeline executes up to 10 stages per run, including external literature queries (arXiv, Crossref), multi-step LLM synthesis, and sandbox code execution (Stage 8), which can take several minutes.
- **Dedicated Worker Process**: The `worker.py` daemon continuously polls for queued research runs, acquires atomic database leases, handles heartbeat renewal, and recovers failed jobs. It must run in a persistent container or VM environment.

---

## 2. Infrastructure Requirements & Recommended Stack

| Component | Recommended Production Provider | Alternative | Minimum Sizing |
| :--- | :--- | :--- | :--- |
| **Frontend** | [Vercel](https://vercel.com) | Cloudflare Pages, AWS Amplify | Edge Network (Free/Pro) |
| **Backend API** | [Railway](https://railway.app) / [Render](https://render.com) | AWS ECS (Fargate), Fly.io | 1 vCPU, 2 GB RAM |
| **Research Worker** | Dedicated Railway Service / ECS | Docker Compose on VPS | 1–2 vCPU, 2–4 GB RAM |
| **Database** | [Neon](https://neon.tech) / [Supabase](https://supabase.com) | AWS RDS PostgreSQL 16 | PostgreSQL 16 with pgvector |
| **Cache & Bus** | [Upstash Redis](https://upstash.com) | Railway Redis, Redis Cloud | Redis 7.0+ (TLS enabled) |
| **Artifacts** | Persistent Block/EFS Volume | AWS S3 / Cloudflare R2 | 20 GB+ persistent storage |

---

## 3. Step-by-Step Deployment Procedure

### Step 1: Provision Production Database (PostgreSQL)
1. Create a PostgreSQL 16 instance on **Neon**, **Supabase**, or **AWS RDS**.
2. Enable the `pgvector` extension by running:
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```
3. Copy your database connection string and ensure it uses the `postgresql+asyncpg://` protocol:
   ```text
   postgresql+asyncpg://user:password@ep-host.region.neon.tech/neondb?ssl=require
   ```
4. If migrating from a local SQLite database, run the migration tool:
   ```bash
   python scripts/migrate_sqlite_to_postgres.py \
     --sqlite-path backend/auto_researcher.db \
     --postgres-url "postgresql+asyncpg://user:password@host:5432/db"
   ```

### Step 2: Provision Production Redis
1. Create a Redis instance on **Upstash** or **Railway**.
2. Note your secure Redis connection URL:
   ```text
   rediss://default:your-token@your-redis-instance.upstash.io:6379
   ```

### Step 3: Deploy Backend & Worker Services (Railway / Docker / VPS)

#### Option A: Using Pre-Configured Docker Compose (Single Host / VPS)
1. Clone the repository onto your host server:
   ```bash
   git clone https://github.com/your-org/auto-researcher.git
   cd auto-researcher
   ```
2. Create production `.env` from template:
   ```bash
   cp .env.example .env
   ```
3. Generate a cryptographically secure application secret:
   ```bash
   python3 -c "import secrets; print(secrets.token_hex(32))"
   ```
   Set this value as `AUTO_RESEARCHER_SECRET` in `.env`.
4. Set `AUTO_RESEARCHER_ENV=production` and add your AI provider API keys.
5. Launch the full production stack:
   ```bash
   docker compose -f docker-compose.prod.yml up -d --build
   ```
6. Verify service health:
   ```bash
   docker compose -f docker-compose.prod.yml ps
   curl -f http://127.0.0.1:8000/api/health
   ```

#### Option B: Deploying to Managed PaaS (Railway / Render)
1. Create a new Project in Railway/Render from your GitHub repository.
2. Add **Backend API** service:
   - Root directory: `backend`
   - Build command: Automatic (detects Dockerfile)
   - Start command: `uv run uvicorn app.main:app --host 0.0.0.0 --port $PORT --workers 2`
   - Environment variables: Set `DATABASE_URL`, `REDIS_URL`, `AUTO_RESEARCHER_SECRET`, `CORS_ORIGINS`, AI keys.
3. Add **Backend Worker** service:
   - Root directory: `backend`
   - Build command: Automatic (uses same Docker image)
   - Start command: `uv run python worker.py`
   - Environment variables: Same as backend API service.
4. Add Persistent Volume:
   - Mount `/app/artifacts` to a persistent disk volume to ensure generated research papers and logs persist across restarts.

### Step 4: Deploy Frontend to Vercel
1. Log in to [Vercel](https://vercel.com) and click **"Add New Project"**.
2. Import your GitHub repository.
3. Configure project settings:
   - **Framework Preset**: `Next.js`
   - **Root Directory**: `frontend` (or leave as root if using repo `vercel.json`)
   - **Build Command**: `npm run build`
   - **Output Directory**: `.next`
   - **Install Command**: `npm ci`
4. Add Environment Variables:
   - `NEXT_PUBLIC_API_BASE_URL`: `https://api.yourdomain.com` (Your backend public URL)
   - `NEXT_PUBLIC_WS_BASE_URL`: `wss://api.yourdomain.com` (Your backend WebSocket URL)
5. Click **Deploy**. Vercel will build and distribute your static pages and client bundles to its global Edge network.

### Step 5: Configure Custom Domains, SSL & CORS
1. In your DNS provider (Cloudflare, Route53, Namecheap):
   - Point `app.yourdomain.com` to Vercel (CNAME `cname.vercel-dns.com`).
   - Point `api.yourdomain.com` to your backend host / load balancer.
2. Ensure SSL/TLS certificates are active (automatic via Vercel and Railway/Cloudflare).
3. Update `CORS_ORIGINS` in your backend environment:
   ```text
   CORS_ORIGINS=https://app.yourdomain.com
   ```
4. Restart the backend API service to apply the origin whitelist.

---

## 4. Production Smoke Tests & Verification

Once deployed, execute the automated readiness suite against your production endpoint:

```bash
# 1. Verify health and database connectivity
curl -I https://api.yourdomain.com/api/health

# Expected response:
# HTTP/2 200
# content-type: application/json
# x-content-type-options: nosniff
# x-frame-options: DENY
# referrer-policy: strict-origin-when-cross-origin
# strict-transport-security: max-age=31536000; includeSubDomains

# 2. Verify worker liveness
curl https://api.yourdomain.com/api/health/live

# 3. Test web app sign in and session cookie
curl -X POST https://api.yourdomain.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"your-admin@example.com","password":"your-secure-password"}' \
  -i
```

---

## 5. Maintenance, Backups & Disaster Recovery

### Automated Database Backups
- Configure daily automated snapshots in your managed database provider (Neon/Supabase/RDS).
- Retention recommendation: 30 days of point-in-time recovery (PITR).

### Artifact Storage Backups
- Set up an automated rsync or S3 sync cron job to mirror the `/app/artifacts` persistent directory to an offsite S3 or Cloudflare R2 bucket.

### Upgrades & Zero-Downtime Deployments
1. Merge new code to `main`.
2. GitHub Actions CI runs tests, linting, and Docker build checks.
3. Backend service triggers rolling container deployment.
4. Database migrations apply automatically during lifespan startup.
5. Vercel atomically switches traffic to the new frontend deployment upon build completion.
