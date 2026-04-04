# Architecture

## Runtime shape

Auto-Researcher is split into five main runtime pieces in the full stack deployment:

- `frontend`: Next.js control surface
- `backend-api`: FastAPI REST + WebSocket API
- `backend-worker`: async orchestration worker
- `postgres`: durable state store
- `redis`: realtime event bus

For lightweight local development, the repository also supports a reduced local-process mode that runs the API, worker, and frontend without Docker. In that mode, SQLite can be used instead of Postgres and the event bus can degrade gracefully when Redis is unavailable.

## Core backend subsystems

1. `Provider Gateway`
   - model profile registry
   - Anthropic, OpenAI, OpenAI-compatible, and CLI-agent clients
   - lightweight connectivity checks
2. `Research Orchestrator`
   - run/stage/task state machine
   - leases, heartbeats, retries, checkpoints
   - recovery and degradation logic
3. `Tool & Retrieval Hub`
   - literature search
   - citation verification
   - claim evidence collection
4. `Experiment Runtime`
   - local subprocess execution
   - Docker execution
   - SSH execution
   - metric extraction
5. `Artifact & Memory Store`
   - stage artifact writing
   - DB metadata index
   - project/run memories
6. `Realtime API`
   - Redis-backed event publication
   - websocket streaming for events and logs

## Data flow

1. User creates a project and provider/compute profiles.
2. User creates a run.
3. Worker acquires a run lease from Postgres.
4. Worker executes one stage at a time, writing artifacts to `artifacts/<project>/<run>/...`.
5. Worker stores metadata and events in Postgres and publishes live updates to Redis.
6. API forwards Redis events to websocket clients.
7. Frontend updates the pipeline board, artifacts panel, chat, and metrics views in realtime.
