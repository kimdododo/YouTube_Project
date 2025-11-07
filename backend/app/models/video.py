"""
Video 모델
SQLAlchemy ORM 모델 정의
실제 travel_videos 테이블 스키마에 맞춰 정의
"""
from sqlalchemy import Column, Integer, String, DateTime, Text, BigInteger, TIMESTAMP, Boolean, JSON
from sqlalchemy.sql import func
from app.core.database import Base


class Video(Base):
    """
    비디오 테이블 모델
    실제 테이블 스키마에 맞춰 정의됨
    """
    __tablename__ = "travel_videos"
    
    id = Column(String(64), primary_key=True, index=True, comment='YouTube 비디오 ID')
    channel_id = Column(String(64), nullable=False, index=True, comment='채널 ID (FK)')
    title = Column(String(500), nullable=False, index=True, comment='비디오 제목')
    description = Column(Text, nullable=True, comment='비디오 설명')
    published_at = Column(DateTime, nullable=True, index=True, comment='게시일시')
    duration = Column(String(20), nullable=True, comment='비디오 길이 (ISO 8601 형식, 예: PT10M30S)')
    duration_sec = Column(Integer, nullable=True, comment='비디오 길이 (초)')
    view_count = Column(BigInteger, nullable=True, default=0, index=True, comment='조회수')
    like_count = Column(Integer, nullable=True, default=0, comment='좋아요 수')
    comment_count = Column(Integer, nullable=True, default=0, comment='댓글 수')
    category_id = Column(Integer, nullable=True, comment='YouTube 카테고리 ID')
    tags = Column(JSON, nullable=True, comment='태그 목록 (JSON)')
    thumbnail_url = Column(String(500), nullable=True, comment='썸네일 URL')
    keyword = Column(String(255), nullable=True, index=True, comment='검색 키워드')
    region = Column(String(100), nullable=True, index=True, comment='지역 (예: 한국, 일본, 동남아)')
    created_at = Column(TIMESTAMP, nullable=True, server_default=func.current_timestamp(), index=True, comment='생성일시')
    updated_at = Column(TIMESTAMP, nullable=True, server_default=func.current_timestamp(), onupdate=func.current_timestamp(), comment='수정일시')
    is_shorts = Column(Boolean, nullable=True, default=False, index=True, comment='YouTube Shorts 여부')
    
    def __repr__(self):
        return f"<Video(id={self.id}, title='{self.title}', channel_id='{self.channel_id}')>"

