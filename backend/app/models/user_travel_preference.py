from sqlalchemy import Column, Integer, ForeignKey, DateTime, func, UniqueConstraint
from app.core.database import Base


class UserTravelPreference(Base):
    """
    사용자 여행 취향 테이블
    사용자가 선택한 여행 취향을 저장합니다.
    """
    __tablename__ = "user_travel_preferences"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    preference_id = Column(Integer, nullable=False, comment="여행 취향 ID (1-11)")
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)
    
    # 같은 사용자가 같은 취향을 중복 선택하지 못하도록 제약
    __table_args__ = (
        UniqueConstraint('user_id', 'preference_id', name='uq_user_preference'),
    )

