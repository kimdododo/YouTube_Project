"""
Channel 스키마
채널 관련 요청/응답 스키마 정의
"""
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class ChannelResponse(BaseModel):
    """채널 응답 스키마"""
    id: str = Field(..., description="채널 ID")
    channel_id: str = Field(..., description="채널 ID (동일)")
    name: str = Field(..., description="채널명")
    subscribers: Optional[str] = Field(None, description="구독자 수 (포맷팅된 문자열)")
    video_count: int = Field(..., description="영상 수")
    total_views: Optional[int] = Field(None, description="총 조회수")
    thumbnail_url: Optional[str] = Field(None, description="썸네일 URL")
    latest_video_date: Optional[datetime] = Field(None, description="최신 영상 게시일")
    
    class Config:
        from_attributes = True


class ChannelListResponse(BaseModel):
    """채널 목록 응답 스키마"""
    channels: list[ChannelResponse]
    total: int

