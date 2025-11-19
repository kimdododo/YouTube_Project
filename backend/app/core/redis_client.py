"""
Redis 클라이언트 유틸리티
Cloud MemoryStore 또는 로컬 Redis 연결
"""
import os
import redis
from functools import lru_cache
from typing import Optional
import logging

logger = logging.getLogger(__name__)

REDIS_URL = os.getenv("REDIS_URL", "")
REDIS_SOCKET_TIMEOUT = float(os.getenv("REDIS_SOCKET_TIMEOUT", "1.5"))
REDIS_RETRY = int(os.getenv("REDIS_RETRY", "3"))


class RedisClient:
    """Redis 클라이언트 싱글턴"""
    
    def __init__(self):
        self._client: Optional[redis.Redis] = None

    def connect(self) -> redis.Redis:
        """Redis 연결 (재시도 로직 포함)"""
        if not REDIS_URL:
            raise ValueError("REDIS_URL 환경 변수가 설정되지 않았습니다. Cloud Memorystore Redis URL을 설정하세요.")
        
        if self._client:
            try:
                self._client.ping()
                return self._client
            except redis.RedisError:
                self._client = None
        
        for attempt in range(1, REDIS_RETRY + 1):
            try:
                self._client = redis.Redis.from_url(
                    REDIS_URL,
                    socket_timeout=REDIS_SOCKET_TIMEOUT,
                    socket_connect_timeout=REDIS_SOCKET_TIMEOUT,
                    health_check_interval=30,
                    decode_responses=False,  # JSON 직렬화를 위해 bytes 반환
                )
                self._client.ping()
                logger.info(f"[Redis] Connected successfully to {REDIS_URL}")
                return self._client
            except redis.RedisError as exc:
                logger.warning(f"[Redis] Connection attempt {attempt}/{REDIS_RETRY} failed: {exc}")
                if attempt == REDIS_RETRY:
                    logger.error(f"[Redis] Failed to connect after {REDIS_RETRY} attempts")
                    raise
        return self._client


@lru_cache
def get_redis() -> redis.Redis:
    """
    Redis 클라이언트 싱글턴 반환
    
    Returns:
        redis.Redis 인스턴스
    """
    client = RedisClient()
    return client.connect()

