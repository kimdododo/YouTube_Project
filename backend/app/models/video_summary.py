"""
VideoSummary 모델
video_summaries 테이블 스키마
"""
from sqlalchemy import Column, Integer, String, Text, DateTime, Index
from sqlalchemy.sql import func
from app.core.database import Base


class VideoSummary(Base):
    """
    비디오 요약 캐시 테이블 모델
    """
    __tablename__ = "video_summaries"
    
    video_id = Column(String(64), primary_key=True, index=True, comment='비디오 ID')
    summary_type = Column(String(50), primary_key=True, index=True, comment='요약 타입 (예: one_line_rag)')
    summary_text = Column(Text, nullable=False, comment='요약 텍스트')
    model_name = Column(String(100), nullable=True, comment='사용된 LLM 모델명')
    rag_version = Column(String(20), nullable=True, default='rag_v1', comment='RAG 버전')
    updated_at = Column(DateTime, nullable=False, server_default=func.now(), onupdate=func.now(), index=True, comment='수정일시')
    
    __table_args__ = (
        Index('idx_video_type', 'video_id', 'summary_type'),
    )
    
    def __repr__(self):
        return f"<VideoSummary(video_id='{self.video_id}', summary_type='{self.summary_type}')>"

