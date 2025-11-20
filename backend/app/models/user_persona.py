"""
User Persona Vector 모델
사용자 프로필 임베딩 벡터 저장
"""
from sqlalchemy import Column, Integer, JSON, DateTime, Index
from sqlalchemy.sql import func
from app.core.database import Base


class UserPersonaVector(Base):
    """
    사용자 프로필 벡터 테이블
    user_persona_vectors 테이블 스키마
    """
    __tablename__ = "user_persona_vectors"
    
    user_id = Column(Integer, primary_key=True, index=True, comment='사용자 ID')
    embedding_json = Column(JSON, nullable=False, comment='사용자 프로필 임베딩 벡터 (JSON 배열)')
    updated_at = Column(DateTime, nullable=False, server_default=func.now(), onupdate=func.now(), index=True, comment='수정일시')
    
    __table_args__ = (
        Index('idx_user_updated', 'user_id', 'updated_at'),
    )
    
    def __repr__(self):
        return f"<UserPersonaVector(user_id={self.user_id}, updated_at={self.updated_at})>"

