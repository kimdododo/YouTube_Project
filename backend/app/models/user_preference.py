"""
User Preference 모델
user_preferences 테이블 스키마 (embedding, topics 포함)
"""
from sqlalchemy import Column, Integer, String, JSON, Float, DateTime, Index
from sqlalchemy.sql import func
from app.core.database import Base


class UserPreference(Base):
    """
    사용자 취향 정보 테이블
    embedding, topics, sentiment_weight 저장
    """
    __tablename__ = "user_preferences"
    
    user_id = Column(Integer, primary_key=True, index=True, comment='사용자 ID')
    embedding = Column(JSON, nullable=True, comment='사용자 취향 임베딩 벡터')
    topics = Column(JSON, nullable=True, comment='11가지 성향 점수 {topic: score}')
    sentiment_weight = Column(Float, default=0.3, nullable=False, comment='감성 가중치')
    updated_at = Column(DateTime, nullable=False, server_default=func.now(), onupdate=func.now(), index=True, comment='수정일시')
    
    __table_args__ = (
        Index('idx_user_updated', 'user_id', 'updated_at'),
    )
    
    def __repr__(self):
        return f"<UserPreference(user_id={self.user_id}, sentiment_weight={self.sentiment_weight})>"

