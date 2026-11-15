# ==============================================================================
# Auto-Researcher Production Backend Dockerfile
# Optimized multi-stage build supporting both FastAPI Web API and Worker Daemon
# ==============================================================================

FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/root/.local/bin:$PATH"

# Install essential system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

# Install uv for reproducible, fast dependency management
RUN curl -LsSf https://astral.sh/uv/install.sh | sh

WORKDIR /app

# Copy dependency manifests
COPY pyproject.toml uv.lock* /app/

# Install production dependencies only
RUN uv sync --frozen --no-dev || uv sync --no-dev

# Copy application source code
COPY app /app/app
COPY worker.py /app/worker.py

# Create artifacts directory with appropriate write permissions
RUN mkdir -p /app/artifacts

# Expose standard FastAPI port
EXPOSE 8000

# Container healthcheck against /api/health
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://127.0.0.1:8000/api/health || exit 1

# Default launch command: FastAPI production server
CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
