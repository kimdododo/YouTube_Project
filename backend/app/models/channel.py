"""
Channel 모델
SQLAlchemy ORM 모델 정의
실제 travel_channels 테이블 스키마에 맞춰 정의
"""
from sqlalchemy import Column, Integer, String, Text, BigInteger, TIMESTAMP
from sqlalchemy.sql import func
from app.core.database import Base


class Channel(Base):
    """
    채널 테이블 모델
    실제 travel_channels 테이블 스키마에 맞춰 정의됨
    """
    __tablename__ = "travel_channels"
    
    id = Column(String(64), primary_key=True, index=True, comment='채널 ID (YouTube 채널 ID)')
    title = Column(String(500), nullable=True, comment='채널명')
    description = Column(Text, nullable=True, comment='채널 설명')
    country = Column(String(10), nullable=True, comment='국가 코드')
    subscriber_count = Column(BigInteger, nullable=True, default=0, comment='구독자 수')
    video_count = Column(Integer, nullable=True, default=0, comment='영상 수')
    view_count = Column(BigInteger, nullable=True, default=0, comment='총 조회수')
    thumbnail_url = Column(String(500), nullable=True, comment='썸네일 URL')
    
    def __repr__(self):
        return f"<Channel(id={self.id}, title='{self.title}', subscribers={self.subscriber_count})>"

