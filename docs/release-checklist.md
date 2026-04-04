# Release Checklist

Use this checklist before publishing a tagged release or marking a milestone as stable.

## Repository Hygiene

- [ ] `.env` is not committed
- [ ] No real API keys, tokens, or private endpoints are present
- [ ] No local databases are committed
- [ ] No runtime logs are committed
- [ ] `artifacts/` contains no real run outputs
- [ ] `reference/`, local caches, and dependency directories are excluded

## Documentation

- [ ] `README.md` reflects the current product scope
- [ ] `README.zh-CN.md` is updated if user-facing setup changed
- [ ] `CONTRIBUTING.md` matches the current dev workflow
- [ ] `docs/architecture.md` and `docs/runbook.md` are current
- [ ] Breaking changes are documented clearly

## Validation

Backend:

- [ ] `cd backend && uv sync --group dev`
- [ ] `cd backend && uv run pytest`

Frontend:

- [ ] `cd frontend && npm install`
- [ ] `cd frontend && npm run build`

Scripts:

- [ ] `bash -n scripts/*.sh`

## Product Readiness

- [ ] Core API endpoints still match the documented flow
- [ ] Dashboard loads successfully
- [ ] A new run can be created successfully
- [ ] Artifact writing still works
- [ ] Local helper scripts still start and stop the stack

## Release Packaging

- [ ] Version number or release tag is decided
- [ ] Release notes summarize major changes
- [ ] Known limitations are called out
- [ ] License file is present
- [ ] CI is green on the target branch
