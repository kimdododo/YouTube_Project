"""
Comment 모델
travel_comments 테이블 스키마
"""
from sqlalchemy import Column, Integer, String, Text, BigInteger, DateTime, ForeignKey, Index
from sqlalchemy.sql import func
from app.core.database import Base


class Comment(Base):
    """
    댓글 테이블 모델
    """
    __tablename__ = "travel_comments"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    video_id = Column(String(64), ForeignKey("travel_videos.id", ondelete="CASCADE"), nullable=False, index=True, comment='비디오 ID')
    text = Column(Text, nullable=False, comment='댓글 본문')
    like_count = Column(Integer, nullable=True, default=0, comment='좋아요 수')
    created_at = Column(DateTime, nullable=True, server_default=func.now(), comment='생성일시')
    
    __table_args__ = (
        Index('idx_video_like', 'video_id', 'like_count'),
    )
    
    def __repr__(self):
        return f"<Comment(id={self.id}, video_id='{self.video_id}', like_count={self.like_count})>"

