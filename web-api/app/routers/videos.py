from typing import List
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from app.core.settings import get_settings, Settings

router = APIRouter(prefix="/videos", tags=["videos"])


class VideoOut(BaseModel):
    id: str
    title: str
    category_id: str


@router.get("/by-category", response_model=List[VideoOut])
async def get_videos_by_category(
    category_id: str = Query(..., min_length=1),
    settings: Settings = Depends(get_settings),
):
    # mock/in-memory results for now
    sample = [
        {"id": "vid_1", "title": "제주 한달살기 브이로그", "category_id": "local"},
        {"id": "vid_2", "title": "후쿠오카 주말여행", "category_id": "japan"},
    ]
    return [v for v in sample if v["category_id"] == category_id]


