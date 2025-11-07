"""
Video Pydantic 스키마
API 요청/응답 데이터 검증 및 직렬화
"""
from pydantic import BaseModel, Field
from typing import Optional, Union, Any
from datetime import datetime


class VideoBase(BaseModel):
    """비디오 기본 스키마"""
    id: Optional[str] = Field(None, description="YouTube 비디오 ID")
    channel_id: Optional[str] = Field(None, description="채널 ID")
    title: Optional[str] = Field(None, description="비디오 제목")
    description: Optional[str] = Field(None, description="비디오 설명")
    published_at: Optional[datetime] = Field(None, description="게시일시")
    duration: Optional[str] = Field(None, description="비디오 길이 (ISO 8601 형식)")
    duration_sec: Optional[int] = Field(None, description="비디오 길이 (초)")
    view_count: Optional[int] = Field(None, description="조회수")
    like_count: Optional[int] = Field(None, description="좋아요 수")
    comment_count: Optional[int] = Field(None, description="댓글 수")
    category_id: Optional[int] = Field(None, description="카테고리 ID")
    tags: Optional[Union[dict, list, str]] = Field(None, description="태그 목록 (JSON - dict, list, 또는 문자열)")
    thumbnail_url: Optional[str] = Field(None, description="썸네일 URL")
    keyword: Optional[str] = Field(None, description="검색 키워드")
    region: Optional[str] = Field(None, description="지역")
    is_shorts: Optional[bool] = Field(None, description="YouTube Shorts 여부")


class VideoCreate(VideoBase):
    """비디오 생성 스키마"""
    pass


class VideoUpdate(BaseModel):
    """비디오 업데이트 스키마"""
    title: Optional[str] = None
    channel: Optional[str] = None
    description: Optional[str] = None


class VideoResponse(VideoBase):
    """비디오 응답 스키마"""
    id: str = Field(..., description="YouTube 비디오 ID (필수)")
    created_at: Optional[datetime] = Field(None, description="생성일시")
    updated_at: Optional[datetime] = Field(None, description="수정일시")
    
    class Config:
        from_attributes = True  # Pydantic v2 (이전 버전에서는 orm_mode=True)


class VideoListResponse(BaseModel):
    """비디오 목록 응답 스키마"""
    videos: list[VideoResponse]
    total: int

