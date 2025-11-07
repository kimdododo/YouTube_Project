from sqlalchemy.orm import Session
from sqlalchemy import or_
from app.models.user import User
from app.core.security import hash_password, verify_password


def get_by_username_or_email(db: Session, username_or_email: str) -> User | None:
    return db.query(User).filter(
        or_(User.username == username_or_email, User.email == username_or_email)
    ).first()


def create_user(db: Session, username: str, email: str, password: str) -> User:
    try:
        # 비밀번호 해시 생성
        password_hash = hash_password(password)
        print(f"[DEBUG] Password hashed successfully (length: {len(password_hash)})")
        
        # 사용자 객체 생성
        user = User(username=username, email=email, password_hash=password_hash)
        print(f"[DEBUG] User object created: {user}")
        
        # DB에 추가
        db.add(user)
        print(f"[DEBUG] User added to session")
        
        # 커밋
        db.commit()
        print(f"[DEBUG] Transaction committed")
        
        # 새로고침
        db.refresh(user)
        print(f"[DEBUG] User refreshed: id={user.id}, username={user.username}, email={user.email}")
        
        return user
    except Exception as e:
        db.rollback()
        print(f"[ERROR] Error creating user: {str(e)}")
        import traceback
        print(f"[ERROR] Traceback: {traceback.format_exc()}")
        raise


def authenticate(db: Session, username_or_email: str, password: str) -> User | None:
    user = get_by_username_or_email(db, username_or_email)
    if not user:
        return None
    if not verify_password(password, user.password_hash):
        return None
    return user


