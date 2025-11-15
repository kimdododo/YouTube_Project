"""
검색 기록 모델
사용자의 검색 기록을 저장합니다.
"""
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, func, Index
from sqlalchemy.orm import relationship
from app.core.database import Base


class SearchHistory(Base):
    """
    검색 기록 테이블
    사용자가 검색할 때마다 검색어를 저장합니다.
    """
    __tablename__ = "search_history"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    query = Column(String(255), nullable=False, comment="검색어")
    searched_at = Column(DateTime, server_default=func.now(), nullable=False, index=True)
    
    # Relationship
    user = relationship("User", backref="search_history")
    
    # 복합 인덱스: user_id + searched_at로 빠른 조회
    __table_args__ = (
        Index('idx_user_searched_at', 'user_id', 'searched_at'),
    )
    
    def __repr__(self):
        return f"<SearchHistory(id={self.id}, user_id={self.user_id}, query='{self.query}', searched_at={self.searched_at})>"

