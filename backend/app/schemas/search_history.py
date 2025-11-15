"""
검색 기록 스키마
"""
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class SearchHistoryCreate(BaseModel):
    """검색 기록 생성 요청"""
    query: str = Field(..., min_length=1, max_length=255, description="검색어")


class SearchHistoryResponse(BaseModel):
    """검색 기록 응답"""
    query: str
    searched_at: Optional[str] = None


class SearchHistoryListResponse(BaseModel):
    """검색 기록 목록 응답"""
    success: bool = True
    history: list[SearchHistoryResponse]

