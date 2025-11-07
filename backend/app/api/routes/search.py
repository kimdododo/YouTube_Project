from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional
from app.core.database import get_db
from app.core.cache import Cache
from app.core.responses import ok
from sqlalchemy import text

router = APIRouter(prefix="/api/v1/search", tags=["search"])


@router.get("/videos")
def search_videos(
    q: str = Query(..., min_length=1, max_length=128),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=50),
    db: Session = Depends(get_db),
):
    cache = Cache()
    key = f"search:q={q}:page={page}:limit={limit}"
    cached = cache.get_json(key)
    if cached:
        return ok(cached).model_dump()

    offset = (page - 1) * limit
    # Shorts 제외: duration_sec >= 240 조건 (칼럼이 없으면 백업으로 LIKE '#shorts' 제거)
    sql = text(
        """
        SELECT id, channel_id, title, description, published_at, thumbnail_url, view_count
        FROM travel_videos
        WHERE (title LIKE :k OR description LIKE :k)
          AND (duration_sec IS NULL OR duration_sec >= 240)
          AND (LOWER(title) NOT LIKE '%#shorts%' AND LOWER(description) NOT LIKE '%#shorts%')
        ORDER BY published_at DESC
        LIMIT :limit OFFSET :offset
        """
    )
    rows = db.execute(sql, {"k": f"%{q}%", "limit": limit, "offset": offset}).mappings().all()
    data = {
        "items": [dict(r) for r in rows],
        "page": page,
        "limit": limit,
        "query": q,
    }
    cache.set_json(key, data, ttl_sec=60)  # 60초 캐시
    # 인기/자동완성 카운트 누적 (옵션)
    cache.zadd("search:popular", 1, q)
    return ok(data).model_dump()


