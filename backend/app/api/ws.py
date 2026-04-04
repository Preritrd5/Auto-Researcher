from __future__ import annotations

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.services.event_bus import EventBus

router = APIRouter(tags=["ws"])
bus = EventBus()


@router.websocket("/ws/events")
async def events_socket(websocket: WebSocket, run_id: str) -> None:
    await websocket.accept()
    try:
        async for message in bus.subscribe(bus.events_channel(run_id)):
            await websocket.send_json(message)
    except WebSocketDisconnect:
        return


@router.websocket("/ws/logs")
async def logs_socket(websocket: WebSocket, run_id: str) -> None:
    await websocket.accept()
    try:
        async for message in bus.subscribe(bus.logs_channel(run_id)):
            await websocket.send_json(message)
    except WebSocketDisconnect:
        return

