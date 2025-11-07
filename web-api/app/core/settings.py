from functools import lru_cache
from pydantic import BaseSettings, AnyUrl
from typing import Optional


class Settings(BaseSettings):
    REDIS_URL: str = "redis://redis:6379/0"
    ML_API_BASE_URL: Optional[AnyUrl] = None
    PAGE_SIZE_DEFAULT: int = 20
    CACHE_TTL_SECONDS: int = 60

    class Config:
        env_file = ".env"
        case_sensitive = False


@lru_cache()
def get_settings() -> Settings:
    return Settings()


