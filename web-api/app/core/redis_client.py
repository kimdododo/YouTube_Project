import asyncio
from typing import Optional
import redis.asyncio as aioredis
from app.core.settings import Settings

_redis: Optional[aioredis.Redis] = None
_lock = asyncio.Lock()


async def get_redis(settings: Settings) -> aioredis.Redis:
    global _redis
    if _redis is None:
        async with _lock:
            if _redis is None:
                _redis = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
                # Simple ping to ensure connection
                await _redis.ping()
    return _redis


