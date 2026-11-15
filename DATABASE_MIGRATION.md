# Auto-Researcher: Database Migration & Persistence Guide

This guide details the database architecture of **Auto-Researcher**, comparing local SQLite development with enterprise PostgreSQL production deployments, and provides step-by-step instructions for data migration, connection pooling, and zero-data-loss upgrades.

---

## 1. Database Architecture Comparison

| Architectural Aspect | Development (SQLite) | Production (PostgreSQL 16) |
| :--- | :--- | :--- |
| **Driver** | `sqlite+aiosqlite` | `postgresql+asyncpg` |
| **Concurrency** | Single-writer lock | Multi-version concurrency control (MVCC) |
| **Network Access** | Local disk file only | TCP/IP network service with SSL/TLS |
| **Connection Pooling** | Disabled / NullPool | Active async pooling (`DB_POOL_SIZE=10`, `DB_MAX_OVERFLOW=20`) |
| **Vector Search Support** | In-memory cosine calculation | Native vector indexing via `pgvector` extension |
| **High Availability** | None (single host file) | Read replicas, automated failover, PITR backups |

---

## 2. Relational Schema & Table Dependency Order

Auto-Researcher models maintain strict foreign key relationships across 12 relational entities. When migrating or restoring data, records must be imported in topological dependency order:

```mermaid
flowchart TD
    User["users"] --> Project["projects"]
    ModelProfile["model_profiles"] --> Project
    ComputeTarget["compute_targets"] --> Project
    Project --> Budget["budgets"]
    Project --> Run["runs"]
    Project --> Memory["memories"]
    Run --> StageRecord["stages"]
    Run --> Task["tasks"]
    Run --> Artifact["artifacts"]
    Run --> Event["events"]
    Run --> Citation["citations"]
```

1. **`users`**: Operator authentication accounts, password hashes, and roles.
2. **`model_profiles`**: Registered LLM configurations and provider endpoints.
3. **`compute_targets`**: Local and remote execution environments.
4. **`projects`**: Top-level research workspaces owned by operators.
5. **`budgets`**: Financial and compute limits per research project.
6. **`runs`**: Autonomous research executions with lifecycle status and worker leases.
7. **`stages`**: Execution records for each of the 10 sequential pipeline stages.
8. **`tasks`**: Granular agentic sub-tasks.
9. **`artifacts`**: Metadata, SHA-256 checksums, and relative storage paths for generated research papers and logs.
10. **`events`**: Pipeline event log entries for real-time telemetry.
11. **`memories`**: Vector embeddings and long-term research insights.
12. **`citations`**: Bibliographic references discovered and verified during literature scans.

---

## 3. Migration Procedure (SQLite to PostgreSQL)

Auto-Researcher provides an automated migration script (`scripts/migrate_sqlite_to_postgres.py`) that migrates all existing records while preserving IDs, foreign keys, and ISO-8601 timestamps.

### Step 1: Pre-Migration Validation & Dry Run
Execute a dry run to verify schema compatibility and inspect source row counts without committing any changes to the target database:

```bash
python scripts/migrate_sqlite_to_postgres.py \
  --sqlite-path backend/auto_researcher.db \
  --postgres-url "postgresql+asyncpg://user:password@host:5432/auto_researcher" \
  --dry-run
```

**Sample Output:**
```text
======================================================================
AUTO-RESEARCHER: DATABASE MIGRATION (SQLite -> PostgreSQL)
======================================================================
Source (SQLite):     sqlite+aiosqlite:///C:/Users/.../auto_researcher.db
Target (PostgreSQL): host:5432/auto_researcher
Dry Run Mode:        ENABLED (No changes will be committed)
----------------------------------------------------------------------
  - users               : 3 records (dry-run inspected)
  - model_profiles      : 2 records (dry-run inspected)
  - compute_targets     : 1 records (dry-run inspected)
  - projects            : 5 records (dry-run inspected)
  - budgets             : 5 records (dry-run inspected)
  - runs                : 8 records (dry-run inspected)
  - stages              : 80 records (dry-run inspected)
  - tasks               : 0 records (skipped)
  - artifacts           : 24 records (dry-run inspected)
  - events              : 120 records (dry-run inspected)
  - memories            : 12 records (dry-run inspected)
  - citations           : 18 records (dry-run inspected)
----------------------------------------------------------------------
MIGRATION COMPLETE: 276 / 276 records inspected.
======================================================================
```

### Step 2: Execute Live Migration
Ensure the backend API service and background workers are temporarily paused to prevent concurrent writes, then execute the live migration:

```bash
python scripts/migrate_sqlite_to_postgres.py \
  --sqlite-path backend/auto_researcher.db \
  --postgres-url "postgresql+asyncpg://user:password@host:5432/auto_researcher"
```

### Step 3: Verify Data Integrity
Confirm table counts in PostgreSQL using `psql` or database dashboard:
```sql
SELECT count(*) FROM users;
SELECT count(*) FROM projects;
SELECT count(*) FROM runs;
SELECT count(*) FROM artifacts;
```

---

## 4. Connection Pooling Configuration

Auto-Researcher automatically tunes async connection pooling when connecting to PostgreSQL. In `backend/app/core/database.py`, the engine configures:

- `pool_size`: Defaults to `10`. Defines persistent connections ready for immediate query execution.
- `max_overflow`: Defaults to `20`. Allows bursting up to 30 concurrent connections during high traffic.
- `pool_recycle`: Defaults to `300` (seconds). Refreshes connections periodically to avoid firewall timeouts.
- `pool_pre_ping`: Enabled (`True`). Automatically verifies connection vitality before returning it from the pool.

---

## 5. Backup & Disaster Recovery Runbook

### Creating a Snapshot Backup
To take a full PostgreSQL logical backup:
```bash
pg_dump -h <host> -U auto_researcher -d auto_researcher -F c -b -v -f auto_researcher_backup.dump
```

### Restoring from Backup
To restore onto a fresh target database:
```bash
pg_restore -h <host> -U auto_researcher -d auto_researcher -v auto_researcher_backup.dump
```
