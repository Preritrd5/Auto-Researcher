# Contributing to Auto-Researcher

Thanks for your interest in contributing to Auto-Researcher.

This project is intended to be a practical, self-hosted research automation platform. Contributions are welcome across backend orchestration, model providers, retrieval, runtime execution, frontend UX, documentation, and testing.

## Before You Start

- Read the main [README](./README.md) first
- Check the existing docs under [`docs/`](./docs)
- Review [SUPPORT.md](./SUPPORT.md), [SECURITY.md](./SECURITY.md), and [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md)
- Open an issue before starting large or architectural changes

For small bug fixes and documentation improvements, feel free to open a pull request directly.

## Development Setup

### Backend

Requirements:

- Python 3.11+
- [`uv`](https://docs.astral.sh/uv/)

Install dependencies:

```bash
cd backend
uv sync --group dev
```

Run tests:

```bash
uv run pytest
```

### Frontend

Requirements:

- Node.js 20+
- `npm`

Install dependencies:

```bash
cd frontend
npm install
```

Run a production build check:

```bash
npm run build
```

### Full Local Stack

If you want to run the app locally without Docker:

```bash
bash scripts/local-up.sh
```

Stop it with:

```bash
bash scripts/local-down.sh
```

## Project Conventions

### Scope

This repository currently targets:

- single-user deployments
- ML/AI-first research workflows
- durable orchestration and artifact traceability

Please avoid introducing multi-tenant or enterprise-only abstractions unless they are clearly optional and justified.

### Backend Guidelines

- Prefer explicit state transitions over hidden control flow
- Keep run, stage, and task lifecycle logic restart-safe
- Preserve artifact contracts when adding or changing stages
- Add tests for stage transitions, provider adapters, recovery logic, or runtime execution changes

### Frontend Guidelines

- Preserve the existing dashboard information architecture
- Favor clear operator visibility over “magic”
- Keep UI copy concise and user-facing
- Validate significant UI changes with a real browser before merging

### Repository Hygiene

Do not commit:

- `.env` or real API keys
- local databases such as `backend/auto_researcher.db`
- runtime logs under `output/`
- generated artifacts under `artifacts/`
- dependency folders such as `frontend/node_modules/` or `backend/.venv/`

## Pull Request Checklist

Before opening a pull request, make sure you have:

- described the problem and the proposed change clearly
- updated docs if behavior or setup changed
- run backend tests if backend code changed
- run a frontend build if frontend code changed
- avoided committing secrets, local caches, logs, or generated artifacts

## Recommended Validation

Backend changes:

```bash
cd backend
uv sync --group dev
uv run pytest
```

Frontend changes:

```bash
cd frontend
npm install
npm run build
```

Shell script changes:

```bash
bash -n scripts/*.sh
```

## Reporting Security Issues

If you discover a security-sensitive issue, please do not open a public bug report with exploitable details. Share a minimal private report with the maintainer first and allow time for a fix before public disclosure.
