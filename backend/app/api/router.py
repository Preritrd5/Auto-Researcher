from fastapi import APIRouter

from app.api.routes import artifacts, auth, chat, compute_targets, health, model_profiles, projects, providers, runs

api_router = APIRouter(prefix="/api")
api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(projects.router)
api_router.include_router(model_profiles.router)
api_router.include_router(providers.router)
api_router.include_router(compute_targets.router)
api_router.include_router(runs.router)
api_router.include_router(artifacts.router)
api_router.include_router(chat.router)

