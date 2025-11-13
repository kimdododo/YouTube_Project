"""
이메일 인증 모델
인증코드 저장 및 관리
"""
from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey, func, Index
from sqlalchemy.orm import relationship
from app.core.database import Base
from datetime import datetime, timedelta


class EmailVerification(Base):
    """
    이메일 인증코드 테이블
    회원가입 시 발송된 인증코드를 저장하고 관리
    """
    __tablename__ = "email_verifications"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    code = Column(String(10), nullable=False, index=True)  # 6자리 숫자 또는 UUID 토큰
    expires_at = Column(DateTime, nullable=False, index=True)  # 만료 시간
    is_used = Column(Boolean, default=False, nullable=False, index=True)  # 사용 여부
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    
    # Relationship
    user = relationship("User", backref="email_verifications")
    
    # 복합 인덱스: user_id + is_used로 빠른 조회
    __table_args__ = (
        Index('idx_user_unused', 'user_id', 'is_used'),
    )
    
    def is_expired(self) -> bool:
        """인증코드가 만료되었는지 확인"""
        return datetime.utcnow() > self.expires_at
    
    def is_valid(self) -> bool:
        """인증코드가 유효한지 확인 (만료되지 않았고 사용되지 않음)"""
        return not self.is_expired() and not self.is_used
    
    def __repr__(self):
        return f"<EmailVerification(id={self.id}, user_id={self.user_id}, code='{self.code[:3]}***', expires_at={self.expires_at}, is_used={self.is_used})>"

