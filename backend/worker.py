from __future__ import annotations

import asyncio
import socket

from app.db.bootstrap import create_all_tables
from app.orchestrator.worker import ResearchWorker


async def main() -> None:
    await create_all_tables()
    worker_id = f"{socket.gethostname()}-worker"
    worker = ResearchWorker(worker_id=worker_id)
    await worker.run_forever()


if __name__ == "__main__":
    asyncio.run(main())
