"""
사용자 CRUD 작업
FastAPI + SQLAlchemy + Pydantic 구조에 맞게 작성
"""
from sqlalchemy.orm import Session
from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError
from app.models.user import User
from app.core.security import hash_password, verify_password
from typing import Optional
import traceback


def get_by_id(db: Session, user_id: int) -> Optional[User]:
    """
    사용자 ID로 사용자 조회
    
    Args:
        db: 데이터베이스 세션
        user_id: 사용자 ID
    
    Returns:
        User 객체 또는 None
    """
    return db.query(User).filter(User.id == user_id).first()


def get_by_email(db: Session, email: str) -> Optional[User]:
    """
    이메일로 사용자 조회
    회원가입 시 이메일 중복 체크에 사용
    이메일은 대소문자 구분 없이 검색 (소문자로 정규화)
    
    Args:
        db: 데이터베이스 세션
        email: 이메일 주소
    
    Returns:
        User 객체 또는 None
    """
    if not email:
        return None
    # 이메일은 소문자로 정규화하여 비교 (이메일은 대소문자 구분 없음)
    normalized_email = email.strip().lower()
    return db.query(User).filter(User.email == normalized_email).first()


def get_by_username(db: Session, username: str) -> Optional[User]:
    """
    사용자명으로 사용자 조회
    
    Args:
        db: 데이터베이스 세션
        username: 사용자명
    
    Returns:
        User 객체 또는 None
    """
    if not username:
        return None
    return db.query(User).filter(User.username == username).first()


def get_by_username_or_email(db: Session, username_or_email: str) -> Optional[User]:
    """
    사용자명 또는 이메일로 사용자 조회
    로그인 시 사용
    이메일은 대소문자 구분 없이 검색 (소문자로 정규화)
    
    Args:
        db: 데이터베이스 세션
        username_or_email: 사용자명 또는 이메일 주소
    
    Returns:
        User 객체 또는 None
    """
    if not username_or_email:
        return None
    
    # 이메일인 경우 소문자로 정규화 (이메일은 대소문자 구분 없음)
    normalized_input = username_or_email.strip().lower()
    
    return db.query(User).filter(
        or_(
            User.username == username_or_email,  # 사용자명은 대소문자 구분
            User.email == normalized_input  # 이메일은 소문자로 비교
        )
    ).first()


def create_user(
    db: Session,
    username: str,
    email: str,
    password: str,
    is_verified: bool = False
) -> User:
    """
    새 사용자 생성
    - 이메일 중복 체크 수행
    - bcrypt로 비밀번호 해싱
    
    Args:
        db: 데이터베이스 세션
        username: 사용자명
        email: 이메일 주소
        password: 평문 비밀번호 (bcrypt로 해싱됨)
        is_verified: 이메일 인증 여부 (기본값: False)
    
    Returns:
        생성된 User 객체
    
    Raises:
        ValueError: 이메일이 이미 존재하는 경우
        IntegrityError: 데이터베이스 제약 조건 위반
    """
    # 입력값 검증
    if not username or not username.strip():
        raise ValueError("사용자명은 필수입니다.")
    if not email or not email.strip():
        raise ValueError("이메일은 필수입니다.")
    if not password:
        raise ValueError("비밀번호는 필수입니다.")
    
    # 이메일 중복 체크
    existing_user = get_by_email(db, email.strip())
    if existing_user:
        raise ValueError(f"이미 사용 중인 이메일입니다: {email}")
    
    try:
        # 비밀번호 해싱 (bcrypt)
        password_hash = hash_password(password)
        
        # 사용자 객체 생성
        user = User(
            username=username.strip(),
            email=email.strip().lower(),  # 이메일은 소문자로 정규화
            password_hash=password_hash,
            is_verified=is_verified
        )
        
        # DB에 추가
        db.add(user)
        db.commit()
        db.refresh(user)
        
        return user
        
    except IntegrityError as e:
        db.rollback()
        # 이메일 unique 제약 위반
        if "email" in str(e.orig).lower() or "duplicate" in str(e.orig).lower():
            raise ValueError(f"이미 사용 중인 이메일입니다: {email}")
        raise
    except Exception as e:
        db.rollback()
        print(f"[ERROR] Error creating user: {str(e)}")
        print(f"[ERROR] Traceback: {traceback.format_exc()}")
        raise


def authenticate(db: Session, username_or_email: str, password: str) -> Optional[User]:
    """
    사용자 인증
    사용자명 또는 이메일과 비밀번호로 로그인
    
    Args:
        db: 데이터베이스 세션
        username_or_email: 사용자명 또는 이메일 주소
        password: 평문 비밀번호
    
    Returns:
        인증 성공 시 User 객체, 실패 시 None
    """
    if not username_or_email or not password:
        return None
    
    # 사용자 조회
    user = get_by_username_or_email(db, username_or_email)
    if not user:
        return None
    
    # 비밀번호 검증 (bcrypt)
    if not verify_password(password, user.password_hash):
        return None
    
    return user


def verify_user_email(db: Session, user_id: int) -> bool:
    """
    사용자 이메일 인증 완료 처리
    
    Args:
        db: 데이터베이스 세션
        user_id: 사용자 ID
    
    Returns:
        성공 여부 (bool)
    """
    try:
        user = get_by_id(db, user_id)
        if not user:
            return False
        
        user.is_verified = True
        db.commit()
        db.refresh(user)
        return True
    except Exception as e:
        db.rollback()
        print(f"[ERROR] Failed to verify user email for user {user_id}: {e}")
        print(f"[ERROR] Traceback: {traceback.format_exc()}")
        raise


def update_password(db: Session, user_id: int, new_password: str) -> bool:
    """
    사용자 비밀번호 변경
    bcrypt로 새 비밀번호 해싱
    
    Args:
        db: 데이터베이스 세션
        user_id: 사용자 ID
        new_password: 새 평문 비밀번호
    
    Returns:
        성공 여부 (bool)
    """
    if not new_password:
        raise ValueError("비밀번호는 필수입니다.")
    
    try:
        user = get_by_id(db, user_id)
        if not user:
            return False
        
        # 새 비밀번호 해싱 (bcrypt)
        user.password_hash = hash_password(new_password)
        db.commit()
        db.refresh(user)
        return True
    except Exception as e:
        db.rollback()
        print(f"[ERROR] Failed to update password for user {user_id}: {e}")
        print(f"[ERROR] Traceback: {traceback.format_exc()}")
        raise


def check_email_exists(db: Session, email: str) -> bool:
    """
    이메일 존재 여부 확인
    회원가입 시 이메일 중복 체크에 사용
    
    Args:
        db: 데이터베이스 세션
        email: 이메일 주소
    
    Returns:
        이메일이 존재하면 True, 없으면 False
    """
    if not email:
        return False
    user = get_by_email(db, email.strip())
    return user is not None


def update_user_profile(db: Session, user_id: int, username: str = None) -> Optional[User]:
    """
    사용자 프로필 업데이트 (이름 변경)
    
    Args:
        db: 데이터베이스 세션
        user_id: 사용자 ID
        username: 새 사용자명 (선택적)
    
    Returns:
        업데이트된 User 객체 또는 None
    """
    try:
        user = get_by_id(db, user_id)
        if not user:
            return None
        
        # 사용자명 업데이트
        if username is not None:
            if not username.strip():
                raise ValueError("사용자명은 필수입니다.")
            user.username = username.strip()
        
        db.commit()
        db.refresh(user)
        return user
    except Exception as e:
        db.rollback()
        print(f"[ERROR] Failed to update user profile for user {user_id}: {e}")
        print(f"[ERROR] Traceback: {traceback.format_exc()}")
        raise
