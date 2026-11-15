#!/usr/bin/env python3
"""
Auto-Researcher: Phase 5 Production Readiness Verification Suite
Validates 20 distinct deployment checkpoints across architecture, security,
database migration, containerization, and API health.
"""

from __future__ import annotations

import json
import os
import sys
import urllib.request
import urllib.error
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[1]
BACKEND_DIR = ROOT_DIR / "backend"
FRONTEND_DIR = ROOT_DIR / "frontend"

def check(condition: bool, name: str, details: str = ""):
    status = "PASS" if condition else "FAIL"
    print(f"[{status:<4}] {name:<50} {details}")
    if not condition:
        raise AssertionError(f"Checkpoint failed: {name} - {details}")

def main():
    print("=" * 75)
    print("AUTO-RESEARCHER: PHASE 5 PRODUCTION READINESS AUDIT")
    print("=" * 75)

    # 1. Frontend & Vercel Configuration
    print("\n--- 1. Frontend & Vercel Deployment ---")
    frontend_vercel = FRONTEND_DIR / "vercel.json"
    root_vercel = ROOT_DIR / "vercel.json"
    check(frontend_vercel.exists(), "frontend/vercel.json exists", str(frontend_vercel))
    check(root_vercel.exists(), "Root vercel.json exists", str(root_vercel))

    with open(frontend_vercel, "r", encoding="utf-8") as f:
        v_data = json.load(f)
        check(v_data.get("framework") == "nextjs", "Vercel framework is 'nextjs'", "")
        check(len(v_data.get("headers", [])) > 0, "Vercel security headers configured", "")

    next_build_dir = FRONTEND_DIR / ".next"
    check(next_build_dir.exists(), "Next.js production build output exists", str(next_build_dir))

    # 2. Containerization & Orchestration
    print("\n--- 2. Containerization & Orchestration ---")
    dockerfile = BACKEND_DIR / "Dockerfile"
    compose_prod = ROOT_DIR / "docker-compose.prod.yml"
    check(dockerfile.exists(), "backend/Dockerfile exists", str(dockerfile))
    check(compose_prod.exists(), "docker-compose.prod.yml exists", str(compose_prod))

    df_content = dockerfile.read_text(encoding="utf-8")
    check("HEALTHCHECK" in df_content, "Backend Dockerfile has HEALTHCHECK", "")
    check("uv sync" in df_content, "Backend Dockerfile installs with uv sync", "")

    compose_content = compose_prod.read_text(encoding="utf-8")
    check("postgres:" in compose_content and "redis:" in compose_content, "Compose has postgres & redis services", "")
    check("backend-worker:" in compose_content, "Compose has dedicated backend-worker daemon", "")

    # 3. Database Migration & Persistence
    print("\n--- 3. Database & Migration Layer ---")
    migrator = ROOT_DIR / "scripts" / "migrate_sqlite_to_postgres.py"
    check(migrator.exists(), "Migration script exists", str(migrator))

    # 4. Environment Variables & Secret Hygiene
    print("\n--- 4. Environment Variables & Secrets Hygiene ---")
    env_example = ROOT_DIR / ".env.example"
    gitignore = ROOT_DIR / ".gitignore"
    check(env_example.exists(), ".env.example exists", "")
    check(gitignore.exists(), ".gitignore exists", "")

    env_ex_content = env_example.read_text(encoding="utf-8")
    check("AUTO_RESEARCHER_ENV=" in env_ex_content, ".env.example has AUTO_RESEARCHER_ENV", "")
    check("CORS_ORIGINS=" in env_ex_content, ".env.example has CORS_ORIGINS", "")
    check("DATABASE_URL=" in env_ex_content, ".env.example has DATABASE_URL", "")
    check("REDIS_URL=" in env_ex_content, ".env.example has REDIS_URL", "")
    check("OPENAI_API_KEY=" in env_ex_content, ".env.example has AI provider keys", "")
    check("NEXT_PUBLIC_API_BASE_URL=" in env_ex_content, ".env.example has frontend public vars", "")

    gi_content = gitignore.read_text(encoding="utf-8")
    check(".env" in gi_content and "!.env.example" in gi_content, ".gitignore protects .env while keeping example", "")
    check("*.db" in gi_content, ".gitignore protects local sqlite databases", "")

    # 5. Live Health & Observability Probes
    print("\n--- 5. API Health & Observability Probes ---")
    api_base = "http://127.0.0.1:8000"
    
    # Probe /api/health
    req = urllib.request.Request(f"{api_base}/api/health")
    with urllib.request.urlopen(req, timeout=5) as resp:
        check(resp.status == 200, "GET /api/health returns 200 OK", "")
        h_data = json.loads(resp.read().decode())
        check(h_data.get("status") == "healthy", "Health status is 'healthy'", str(h_data))
        check(h_data.get("database") == "connected", "Database probe confirms 'connected'", "")
        
        # Check security headers on response
        headers = dict(resp.headers)
        check(headers.get("x-content-type-options") == "nosniff", "Header X-Content-Type-Options: nosniff", "")
        check(headers.get("x-frame-options") == "DENY", "Header X-Frame-Options: DENY", "")
        check("referrer-policy" in headers, "Header Referrer-Policy present", "")

    # Probe /api/health/live
    with urllib.request.urlopen(f"{api_base}/api/health/live", timeout=5) as resp:
        live_data = json.loads(resp.read().decode())
        check(live_data.get("status") == "alive", "GET /api/health/live returns 'alive'", "")

    # Probe /api/health/ready
    with urllib.request.urlopen(f"{api_base}/api/health/ready", timeout=5) as resp:
        ready_data = json.loads(resp.read().decode())
        check(ready_data.get("status") == "ready", "GET /api/health/ready returns 'ready'", "")

    # 6. CI/CD Workflow
    print("\n--- 6. CI/CD Automation ---")
    ci_file = ROOT_DIR / ".github" / "workflows" / "ci.yml"
    check(ci_file.exists(), ".github/workflows/ci.yml exists", str(ci_file))
    ci_content = ci_file.read_text(encoding="utf-8")
    check("uv run pytest" in ci_content, "CI runs backend pytest tests", "")
    check("npm run build" in ci_content, "CI runs frontend build", "")
    check("docker" in ci_content.lower(), "CI includes Docker validation", "")

    print("\n" + "=" * 75)
    print("ALL 20 PRODUCTION READINESS AUDIT CHECKPOINTS PASSED SUCCESSFULLY!")
    print("=" * 75)

if __name__ == "__main__":
    main()
