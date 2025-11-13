from sqlalchemy import Column, Integer, String, DateTime, Boolean, func
from app.core.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    username = Column(String(64), nullable=False, index=True)  # unique 제거: 동명이인 허용
    email = Column(String(255), nullable=False, unique=True, index=True)
    password_hash = Column(String(255), nullable=False)
    is_verified = Column(Boolean, default=False, nullable=False, index=True)  # 이메일 인증 여부
    created_at = Column(DateTime, server_default=func.now(), nullable=False)


