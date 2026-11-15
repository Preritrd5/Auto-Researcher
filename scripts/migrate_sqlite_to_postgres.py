#!/usr/bin/env python3
"""
Auto-Researcher: SQLite to PostgreSQL Migration Tool
Safely transfers all tables, relations, and data from local SQLite database
to a production PostgreSQL database preserving foreign keys, IDs, and timestamps.

Usage:
    python scripts/migrate_sqlite_to_postgres.py [--sqlite-path PATH] [--postgres-url URL] [--dry-run]
"""

from __future__ import annotations

import argparse
import asyncio
import os
import sys
from pathlib import Path
from typing import Any

# Ensure backend root is on sys.path
backend_path = Path(__file__).resolve().parents[1] / "backend"
if str(backend_path) not in sys.path:
    sys.path.insert(0, str(backend_path))

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.db.models import (
    Artifact,
    Base,
    Budget,
    Citation,
    ComputeTarget,
    Event,
    Memory,
    ModelProfile,
    Project,
    Run,
    StageRecord,
    Task,
    User,
)

# Ordered tables respecting foreign key dependency tree
TABLE_MODELS = [
    ("users", User),
    ("model_profiles", ModelProfile),
    ("compute_targets", ComputeTarget),
    ("projects", Project),
    ("budgets", Budget),
    ("runs", Run),
    ("stages", StageRecord),
    ("tasks", Task),
    ("artifacts", Artifact),
    ("events", Event),
    ("memories", Memory),
    ("citations", Citation),
]


async def migrate_data(
    sqlite_url: str,
    postgres_url: str,
    dry_run: bool = False,
) -> dict[str, dict[str, int]]:
    print("=" * 70)
    print("AUTO-RESEARCHER: DATABASE MIGRATION (SQLite -> PostgreSQL)")
    print("=" * 70)
    print(f"Source (SQLite):     {sqlite_url}")
    print(f"Target (PostgreSQL): {postgres_url.split('@')[-1] if '@' in postgres_url else postgres_url}")
    print(f"Dry Run Mode:        {'ENABLED (No changes will be committed)' if dry_run else 'DISABLED'}")
    print("-" * 70)

    # 1. Initialize Engines
    sqlite_engine = create_async_engine(sqlite_url, echo=False)
    pg_engine = create_async_engine(postgres_url, echo=False)

    SqliteSession = async_sessionmaker(sqlite_engine, expire_on_commit=False, class_=AsyncSession)
    PgSession = async_sessionmaker(pg_engine, expire_on_commit=False, class_=AsyncSession)

    results: dict[str, dict[str, int]] = {}

    try:
        # 2. Ensure schema exists on target PostgreSQL
        if not dry_run:
            print("[INFO] Creating tables on target PostgreSQL database if not present...")
            async with pg_engine.begin() as pg_conn:
                await pg_conn.run_sync(Base.metadata.create_all)
            print("[OK] PostgreSQL schema verified/created.")

        # 3. Stream data table by table
        async with SqliteSession() as src_session, PgSession() as dst_session:
            for table_name, model_cls in TABLE_MODELS:
                # Count source rows
                src_count_res = await src_session.execute(text(f"SELECT COUNT(*) FROM {table_name}"))
                src_count = src_count_res.scalar() or 0

                if src_count == 0:
                    results[table_name] = {"source": 0, "migrated": 0}
                    print(f"  - {table_name:<20}: 0 records (skipped)")
                    continue

                # Query all records from SQLite
                records_res = await src_session.execute(select(model_cls))
                records = records_res.scalars().all()

                migrated_count = 0
                if not dry_run:
                    for obj in records:
                        # Extract column values into dict for clean target instantiation
                        cols = {c.name: getattr(obj, c.name) for c in model_cls.__table__.columns}
                        target_obj = model_cls(**cols)
                        await dst_session.merge(target_obj)
                        migrated_count += 1

                    await dst_session.commit()
                else:
                    migrated_count = src_count

                results[table_name] = {"source": src_count, "migrated": migrated_count}
                print(f"  - {table_name:<20}: {src_count} -> {migrated_count} records migrated [OK]")

        print("-" * 70)
        total_src = sum(r["source"] for r in results.values())
        total_migrated = sum(r["migrated"] for r in results.values())
        print(f"MIGRATION COMPLETE: {total_migrated} / {total_src} records transferred across {len(results)} tables.")
        if dry_run:
            print("[NOTE] Dry-run completed. No data was written to PostgreSQL.")
        print("=" * 70)

    finally:
        await sqlite_engine.dispose()
        await pg_engine.dispose()

    return results


def main() -> None:
    parser = argparse.ArgumentParser(description="Migrate Auto-Researcher SQLite database to PostgreSQL")
    default_db_path = backend_path / "auto_researcher.db"
    parser.add_argument(
        "--sqlite-path",
        default=str(default_db_path),
        help="Path to SQLite database file",
    )
    parser.add_argument(
        "--postgres-url",
        default=os.getenv("DATABASE_URL", ""),
        help="PostgreSQL connection string (e.g. postgresql+asyncpg://user:pass@host:5432/db)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Simulate migration without writing to PostgreSQL",
    )
    args = parser.parse_args()

    sqlite_file = Path(args.sqlite_path).resolve()
    if not sqlite_file.exists():
        print(f"[ERROR] SQLite database file not found: {sqlite_file}")
        sys.exit(1)

    sqlite_url = f"sqlite+aiosqlite:///{sqlite_file.as_posix()}"
    postgres_url = args.postgres_url.strip()

    if not postgres_url or "sqlite" in postgres_url:
        print("[ERROR] A valid PostgreSQL URL is required via --postgres-url or DATABASE_URL env var.")
        print("Example: postgresql+asyncpg://auto_researcher:password@localhost:5432/auto_researcher")
        sys.exit(1)

    asyncio.run(migrate_data(sqlite_url, postgres_url, dry_run=args.dry_run))


if __name__ == "__main__":
    main()
