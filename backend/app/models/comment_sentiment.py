"""
Comment Sentiment Summary 모델
comment_sentiment_summaries 테이블 스키마
댓글 감정 분석 결과 캐싱용
"""
from sqlalchemy import Column, String, Float, JSON, DateTime, Index
from sqlalchemy.sql import func
from app.core.database import Base


class CommentSentimentSummary(Base):
    """
    댓글 감정 요약 캐시 테이블 모델
    """
    __tablename__ = "comment_sentiment_summaries"
    
    video_id = Column(String(64), primary_key=True, index=True, comment='비디오 ID')
    positive_ratio = Column(Float, nullable=False, comment='긍정 비율 (0.0-1.0)')
    negative_ratio = Column(Float, nullable=False, comment='부정 비율 (0.0-1.0)')
    positive_keywords = Column(JSON, nullable=False, comment='긍정 키워드 리스트')
    negative_keywords = Column(JSON, nullable=False, comment='부정 키워드 리스트')
    analyzed_comments_count = Column(Float, nullable=False, default=0, comment='분석한 댓글 수')
    model_name = Column(String(100), nullable=True, comment='사용된 LLM 모델명')
    updated_at = Column(DateTime, nullable=False, server_default=func.now(), onupdate=func.now(), index=True, comment='수정일시')
    
    __table_args__ = (
        Index('idx_video_updated', 'video_id', 'updated_at'),
    )
    
    def __repr__(self):
        return f"<CommentSentimentSummary(video_id='{self.video_id}', positive_ratio={self.positive_ratio}, negative_ratio={self.negative_ratio})>"

