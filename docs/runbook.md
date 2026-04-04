# Operator Runbook

## First-time setup

1. Copy `.env.example` to `.env`.
2. Fill API keys you intend to use.
3. Start the stack with either:
   - Docker Compose: `docker compose -f infra/docker-compose.yml up --build`
   - Local helper script: `bash scripts/local-up.sh`
4. Open the frontend and create:
   - one or more model profiles
   - at least one compute target
   - a project with budget defaults
5. Launch a run from the dashboard.

## Recovery

- If the API stops, restart `backend-api`.
- If the worker stops, restart `backend-worker`.
- The worker uses DB leases and heartbeats, so stale leases are automatically reclaimed after expiration.
- If you are using local helper scripts, stop and restart the local stack with:
  - `bash scripts/local-down.sh`
  - `bash scripts/local-up.sh`

## Safety gates

The worker will stop a run when:

- budget is exhausted
- required provider credentials are missing
- dangerous CLI/runtime behavior is detected
- recovery exceeds 3 attempts for the same stage
- a final publish action would occur without confirmation
