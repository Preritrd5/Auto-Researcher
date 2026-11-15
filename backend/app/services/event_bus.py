from __future__ import annotations

import asyncio
import json
import time
from collections.abc import AsyncIterator

from redis.asyncio import Redis
from redis.exceptions import RedisError

from app.core.config import get_settings


class EventBus:
    def __init__(self) -> None:
        self.settings = get_settings()
        self._redis = Redis.from_url(
            self.settings.redis_url,
            decode_responses=True,
            socket_connect_timeout=0.2,
            socket_timeout=0.2,
        )
        self._redis_unavailable_until: float = 0.0

    @staticmethod
    def events_channel(run_id: str) -> str:
        return f"run:{run_id}:events"

    @staticmethod
    def logs_channel(run_id: str) -> str:
        return f"run:{run_id}:logs"

    async def publish_event(self, run_id: str, payload: dict) -> None:
        await self._publish(self.events_channel(run_id), payload)

    async def publish_log(self, run_id: str, payload: dict) -> None:
        await self._publish(self.logs_channel(run_id), payload)

    async def _publish(self, channel: str, payload: dict) -> None:
        if time.time() < self._redis_unavailable_until:
            return
        try:
            await self._redis.publish(channel, json.dumps(payload, ensure_ascii=False))
        except (RedisError, OSError, TimeoutError):
            self._redis_unavailable_until = time.time() + 5.0
            return

    async def subscribe(self, channel: str) -> AsyncIterator[dict]:
        pubsub = self._redis.pubsub()
        try:
            await pubsub.subscribe(channel)
            while True:
                try:
                    message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)
                except RedisError:
                    yield {
                        "event_type": "bus.degraded",
                        "message": f"Redis unavailable for channel {channel}; realtime stream is degraded.",
                        "payload": {"channel": channel},
                    }
                    return
                if message and message.get("data"):
                    yield json.loads(message["data"])
                await asyncio.sleep(0.05)
        except RedisError:
            yield {
                "event_type": "bus.degraded",
                "message": f"Redis unavailable for channel {channel}; realtime stream is degraded.",
                "payload": {"channel": channel},
            }
        finally:
            try:
                await pubsub.unsubscribe(channel)
                await pubsub.close()
            except RedisError:
                pass
