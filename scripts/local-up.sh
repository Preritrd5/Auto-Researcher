#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUNTIME_DIR="$ROOT_DIR/output/runtime"
mkdir -p "$RUNTIME_DIR"

API_PID_FILE="$RUNTIME_DIR/backend-api.pid"
WORKER_PID_FILE="$RUNTIME_DIR/backend-worker.pid"
FRONTEND_PID_FILE="$RUNTIME_DIR/frontend.pid"

API_LOG_FILE="$RUNTIME_DIR/backend-api.log"
WORKER_LOG_FILE="$RUNTIME_DIR/backend-worker.log"
FRONTEND_BUILD_LOG_FILE="$RUNTIME_DIR/frontend-build.log"
FRONTEND_LOG_FILE="$RUNTIME_DIR/frontend.log"

if [[ -f "$ROOT_DIR/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT_DIR/.env"
  set +a
fi

export DATABASE_URL="sqlite+aiosqlite:///$ROOT_DIR/backend/auto_researcher.db"
export REDIS_URL="${REDIS_URL:-redis://localhost:6379/0}"
export ARTIFACTS_ROOT="$ROOT_DIR/artifacts"
export NEXT_PUBLIC_API_BASE_URL="http://127.0.0.1:8000"
export NEXT_PUBLIC_WS_BASE_URL="ws://127.0.0.1:8000"

require_command() {
  local command_name="$1"
  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "Missing required command: $command_name"
    exit 1
  fi
}

is_running() {
  local pid_file="$1"
  if [[ ! -f "$pid_file" ]]; then
    return 1
  fi

  local pid
  pid="$(cat "$pid_file")"
  if [[ -z "$pid" ]]; then
    return 1
  fi

  kill -0 "$pid" >/dev/null 2>&1
}

start_service() {
  local name="$1"
  local workdir="$2"
  local pid_file="$3"
  local log_file="$4"
  local command="$5"
  local launch_prefix=""

  if is_running "$pid_file"; then
    echo "$name is already running (pid $(cat "$pid_file"))."
    return 0
  fi

  if command -v setsid >/dev/null 2>&1; then
    launch_prefix="setsid"
  fi

  rm -f "$pid_file"
  (
    cd "$workdir"
    nohup $launch_prefix bash -lc "$command" >"$log_file" 2>&1 < /dev/null &
    echo $! >"$pid_file"
  )
  echo "Started $name (pid $(cat "$pid_file"))."
}

wait_for_http() {
  local name="$1"
  local url="$2"
  local log_file="$3"

  for _ in {1..60}; do
    if curl -sf "$url" >/dev/null 2>&1; then
      echo "$name is ready: $url"
      return 0
    fi
    sleep 1
  done

  echo "$name did not become ready in time."
  echo "Last log lines from $log_file:"
  tail -n 40 "$log_file" || true
  exit 1
}

require_command uv
require_command npm
require_command curl

if [[ ! -d "$ROOT_DIR/backend/.venv" ]]; then
  echo "Missing backend virtualenv. Run: cd backend && uv sync"
  exit 1
fi

if [[ ! -d "$ROOT_DIR/frontend/node_modules" ]]; then
  echo "Missing frontend dependencies. Run: cd frontend && npm install"
  exit 1
fi

echo "Starting backend API..."
start_service \
  "backend API" \
  "$ROOT_DIR/backend" \
  "$API_PID_FILE" \
  "$API_LOG_FILE" \
  "uv run uvicorn app.main:app --host 127.0.0.1 --port 8000"
wait_for_http "backend API" "http://127.0.0.1:8000/api/health" "$API_LOG_FILE"

echo "Starting backend worker..."
start_service \
  "backend worker" \
  "$ROOT_DIR/backend" \
  "$WORKER_PID_FILE" \
  "$WORKER_LOG_FILE" \
  "uv run python worker.py"

echo "Building frontend..."
(
  cd "$ROOT_DIR/frontend"
  npm run build >"$FRONTEND_BUILD_LOG_FILE" 2>&1
)
echo "Frontend build complete."

echo "Starting frontend..."
start_service \
  "frontend" \
  "$ROOT_DIR/frontend" \
  "$FRONTEND_PID_FILE" \
  "$FRONTEND_LOG_FILE" \
  "npm run start -- --hostname 127.0.0.1 --port 3000"
wait_for_http "frontend" "http://127.0.0.1:3000" "$FRONTEND_LOG_FILE"

echo
echo "Auto-Researcher is running."
echo "Frontend: http://127.0.0.1:3000"
echo "Backend API: http://127.0.0.1:8000/docs"
echo "Logs:"
echo "  $API_LOG_FILE"
echo "  $WORKER_LOG_FILE"
echo "  $FRONTEND_BUILD_LOG_FILE"
echo "  $FRONTEND_LOG_FILE"
