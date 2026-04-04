from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.api.ws import router as ws_router
from app.core.config import get_settings
from app.core.database import session_scope
from app.db.bootstrap import bootstrap_defaults, create_all_tables

settings = get_settings()


@asynccontextmanager
async def lifespan(_: FastAPI):
    await create_all_tables()
    async with session_scope() as session:
        await bootstrap_defaults(session)
    yield


app = FastAPI(title="Auto-Researcher API", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)
app.include_router(api_router)
app.include_router(ws_router)

