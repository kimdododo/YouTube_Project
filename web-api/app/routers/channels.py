from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from app.core.settings import get_settings, Settings
from app.core.redis_client import get_redis

router = APIRouter(prefix="/channels", tags=["channels"])


class ChannelOut(BaseModel):
    id: str
    name: str
    category: Optional[str] = None
    subscriber_count: Optional[int] = None


MOCK_CHANNELS = [
    {"id": "ch_1", "name": "곽튜브", "category": "여행", "subscriber_count": 1000000},
    {"id": "ch_2", "name": "빠니보틀", "category": "여행", "subscriber_count": 800000},
    {"id": "ch_3", "name": "제주라이프", "category": "로컬", "subscriber_count": 180000},
]


@router.get("/search", response_model=List[ChannelOut])
async def search_channels(
    q: str = Query(..., min_length=1),
    page: int = Query(1, ge=1),
    settings: Settings = Depends(get_settings),
):
    redis = await get_redis(settings)
    key = f"search:channels:q={q}:page={page}"

    cached = await redis.get(key)
    if cached:
        # decode_responses=True so value is already str; FastAPI will re-serialize
        import json
        return json.loads(cached)

    # mock search
    results = [c for c in MOCK_CHANNELS if q.lower() in c["name"].lower()]

    import json
    await redis.setex(key, settings.CACHE_TTL_SECONDS, json.dumps(results, ensure_ascii=False))
    return results


