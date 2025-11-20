"""
User Video Event 모델
사용자 영상 시청/좋아요 이벤트 추적
"""
from sqlalchemy import Column, Integer, String, DateTime, Boolean, BigInteger, Index, ForeignKey
from sqlalchemy.sql import func
from app.core.database import Base


class UserVideoEvent(Base):
    """
    사용자 영상 이벤트 테이블
    user_video_events 테이블 스키마
    """
    __tablename__ = "user_video_events"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True, comment='사용자 ID')
    video_id = Column(String(64), ForeignKey("travel_videos.id", ondelete="CASCADE"), nullable=False, index=True, comment='비디오 ID')
    event_type = Column(String(50), nullable=False, index=True, comment='이벤트 타입 (watch, like, bookmark 등)')
    watch_time = Column(BigInteger, nullable=True, default=0, comment='시청 시간 (초)')
    liked = Column(Boolean, nullable=True, default=False, comment='좋아요 여부')
    created_at = Column(DateTime, nullable=False, server_default=func.now(), index=True, comment='생성일시')
    
    __table_args__ = (
        Index('idx_user_video_event', 'user_id', 'video_id', 'event_type'),
        Index('idx_user_created', 'user_id', 'created_at'),
    )
    
    def __repr__(self):
        return f"<UserVideoEvent(id={self.id}, user_id={self.user_id}, video_id='{self.video_id}', event_type='{self.event_type}')>"

