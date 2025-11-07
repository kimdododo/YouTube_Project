from typing import List, Optional
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/trends", tags=["trends"])


class TrendItem(BaseModel):
    title: str
    view_count: int
    category: str


@router.get("", response_model=List[TrendItem])
async def get_trends():
    # dummy data structure only
    return [
        {"title": "부산 여행 핫플 10", "view_count": 123456, "category": "국내"},
        {"title": "오사카 먹방 투어", "view_count": 98765, "category": "해외"},
    ]


