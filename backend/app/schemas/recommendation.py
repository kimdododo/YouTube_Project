"""
추천 시스템 관련 스키마
"""
from pydantic import BaseModel, Field
from typing import List, Optional


class UserPreferenceRequest(BaseModel):
    """사용자 선호도 요청 스키마"""
    preferred_tags: Optional[List[str]] = Field(None, description="선호 태그 목록")
    preferred_keywords: Optional[List[str]] = Field(None, description="선호 키워드 목록")
    preferred_regions: Optional[List[str]] = Field(None, description="선호 지역 목록")
    viewed_video_ids: Optional[List[str]] = Field(None, description="시청한 영상 ID 목록")
    bookmarked_video_ids: Optional[List[str]] = Field(None, description="북마크한 영상 ID 목록")
    travel_preferences: Optional[List[int]] = Field(None, description="여행 취향 ID 목록 (1-11)")


class RecommendationResponse(BaseModel):
    """추천 결과 응답 스키마"""
    videos: List[dict]  # VideoResponse 리스트
    total: int
    message: Optional[str] = None

