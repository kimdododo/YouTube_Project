"""
이메일 인증 CRUD 작업
인증코드 생성, 저장, 검증 로직
"""
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from datetime import datetime, timedelta
from app.models.email_verification import EmailVerification
from app.models.user import User
from app.core.config import EMAIL_VERIFICATION_CODE_EXPIRY_MINUTES
import secrets
import string


def generate_verification_code(length: int = 6) -> str:
    """
    인증코드 생성 (6자리 랜덤 숫자)
    
    Args:
        length: 코드 길이 (기본값: 6)
    
    Returns:
        str: 인증코드
    """
    return ''.join(secrets.choice(string.digits) for _ in range(length))


def create_verification_code(
    db: Session,
    user_id: int,
    code_length: int = 6,
    expiry_minutes: int = None
) -> EmailVerification:
    """
    인증코드 생성 및 저장
    
    Args:
        db: 데이터베이스 세션
        user_id: 사용자 ID
        code_length: 코드 길이
        expiry_minutes: 만료 시간 (분), None이면 설정값 사용
    
    Returns:
        EmailVerification: 생성된 인증코드 객체
    """
    if expiry_minutes is None:
        expiry_minutes = EMAIL_VERIFICATION_CODE_EXPIRY_MINUTES
    
    # 기존 미사용 코드들을 무효화 (is_used = True로 설정)
    db.query(EmailVerification).filter(
        and_(
            EmailVerification.user_id == user_id,
            EmailVerification.is_used == False
        )
    ).update({"is_used": True})
    
    # 새 인증코드 생성
    code = generate_verification_code(code_length)
    expires_at = datetime.utcnow() + timedelta(minutes=expiry_minutes)
    
    # DB에 저장
    verification = EmailVerification(
        user_id=user_id,
        code=code,
        expires_at=expires_at,
        is_used=False
    )
    
    db.add(verification)
    db.commit()
    db.refresh(verification)
    
    return verification


def get_valid_verification_code(
    db: Session,
    user_id: int,
    code: str
) -> EmailVerification | None:
    """
    유효한 인증코드 조회 (만료되지 않았고 사용되지 않은 코드)
    
    Args:
        db: 데이터베이스 세션
        user_id: 사용자 ID
        code: 인증코드
    
    Returns:
        EmailVerification | None: 유효한 인증코드 객체 또는 None
    """
    verification = db.query(EmailVerification).filter(
        and_(
            EmailVerification.user_id == user_id,
            EmailVerification.code == code,
            EmailVerification.is_used == False
        )
    ).order_by(EmailVerification.created_at.desc()).first()
    
    if not verification:
        return None
    
    # 만료 확인
    if verification.is_expired():
        return None
    
    return verification


def mark_verification_code_as_used(
    db: Session,
    verification_id: int
) -> bool:
    """
    인증코드를 사용됨으로 표시
    
    Args:
        db: 데이터베이스 세션
        verification_id: 인증코드 ID
    
    Returns:
        bool: 성공 여부
    """
    verification = db.query(EmailVerification).filter(
        EmailVerification.id == verification_id
    ).first()
    
    if not verification:
        return False
    
    verification.is_used = True
    db.commit()
    return True


def invalidate_user_verification_codes(
    db: Session,
    user_id: int
) -> int:
    """
    사용자의 모든 미사용 인증코드를 무효화
    
    Args:
        db: 데이터베이스 세션
        user_id: 사용자 ID
    
    Returns:
        int: 무효화된 코드 개수
    """
    count = db.query(EmailVerification).filter(
        and_(
            EmailVerification.user_id == user_id,
            EmailVerification.is_used == False
        )
    ).update({"is_used": True})
    
    db.commit()
    return count


def get_recent_verification_attempts(
    db: Session,
    user_id: int,
    minutes: int = 10
) -> int:
    """
    최근 인증 시도 횟수 조회 (brute force 방지용)
    
    Args:
        db: 데이터베이스 세션
        user_id: 사용자 ID
        minutes: 조회할 시간 범위 (분)
    
    Returns:
        int: 시도 횟수
    """
    since = datetime.utcnow() - timedelta(minutes=minutes)
    count = db.query(EmailVerification).filter(
        and_(
            EmailVerification.user_id == user_id,
            EmailVerification.created_at >= since
        )
    ).count()
    
    return count

