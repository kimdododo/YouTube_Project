from pydantic import BaseModel, Field
from typing import List


class TravelPreferenceCreate(BaseModel):
    """여행 취향 저장 요청"""
    preference_ids: List[int] = Field(..., description="여행 취향 ID 목록 (1-11)", min_items=1, max_items=11)
    keywords: List[str] | None = Field(default_factory=list, description="선택한 여행 키워드 목록", max_items=11)


class TravelPreferenceResponse(BaseModel):
    """여행 취향 응답"""
    user_id: int
    preference_ids: List[int]
    keywords: List[str] = Field(default_factory=list)
    
    class Config:
        from_attributes = True

