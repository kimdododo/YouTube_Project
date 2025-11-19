"""
Video Static 모델
videos_static 테이블 스키마 (summary, sentiment, topics, embedding 포함)
"""
from sqlalchemy import Column, String, Text, Float, JSON, DateTime, Index
from sqlalchemy.sql import func
from app.core.database import Base


class VideoStatic(Base):
    """
    비디오 정적 정보 테이블
    summary, sentiment, topics, embedding 저장
    """
    __tablename__ = "videos_static"
    
    video_id = Column(String(64), primary_key=True, index=True, comment='비디오 ID')
    summary = Column(Text, nullable=True, comment='비디오 요약')
    sentiment = Column(Float, nullable=True, comment='감정 점수 (0.0-1.0)')
    topics = Column(JSON, nullable=True, comment='토픽 정보 {topic: weight}')
    embedding = Column(JSON, nullable=True, comment='비디오 임베딩 벡터')
    updated_at = Column(DateTime, nullable=False, server_default=func.now(), onupdate=func.now(), index=True, comment='수정일시')
    
    __table_args__ = (
        Index('idx_video_updated', 'video_id', 'updated_at'),
    )
    
    def __repr__(self):
        return f"<VideoStatic(video_id='{self.video_id}', sentiment={self.sentiment})>"

