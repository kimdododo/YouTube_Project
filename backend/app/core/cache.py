import json
import redis
from typing import Optional
from app.core.config import REDIS_URL


class Cache:
    def __init__(self, url: str = REDIS_URL):
        self.client = redis.Redis.from_url(url, decode_responses=True)

    def get_json(self, key: str) -> Optional[dict]:
        val = self.client.get(key)
        if not val:
            return None
        try:
            return json.loads(val)
        except Exception:
            return None

    def set_json(self, key: str, value: dict, ttl_sec: int = 60):
        self.client.set(key, json.dumps(value), ex=ttl_sec)

    def zadd(self, key: str, score: float, member: str):
        self.client.zadd(key, {member: score})


