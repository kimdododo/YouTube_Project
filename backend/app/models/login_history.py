from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, func
from sqlalchemy.orm import relationship
from app.core.database import Base


class LoginHistory(Base):
    """
    로그인 이력 테이블
    사용자가 로그인할 때마다 이력을 저장합니다.
    """
    __tablename__ = "login_history"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    login_time = Column(DateTime, server_default=func.now(), nullable=False, index=True)
    ip_address = Column(String(45), nullable=True, comment="로그인 IP 주소")
    user_agent = Column(String(500), nullable=True, comment="사용자 에이전트 (브라우저 정보)")
    
    # 관계 설정 (선택사항)
    # user = relationship("User", back_populates="login_history")

