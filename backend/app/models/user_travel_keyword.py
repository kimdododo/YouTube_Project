from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, func, UniqueConstraint
from app.core.database import Base


class UserTravelKeyword(Base):
    """
    사용자 여행 키워드 테이블
    사용자가 선택한 여행 키워드를 저장합니다.
    """
    __tablename__ = "user_travel_keywords"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    keyword = Column(String(64), nullable=False, comment="여행 키워드 (예: solo, food 등)")
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    __table_args__ = (
        UniqueConstraint('user_id', 'keyword', name='uq_user_keyword'),
    )



