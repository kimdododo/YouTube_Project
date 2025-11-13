"""
기존 사용자 일괄 인증 처리 스크립트
이메일 인증 기능 추가 전에 생성된 사용자들을 자동으로 인증 처리
"""
import sys
import os
from pathlib import Path

# 프로젝트 루트를 Python 경로에 추가
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.core.database import SessionLocal
from app.models.user import User
from sqlalchemy import text

def verify_existing_users():
    """
    is_verified=False인 모든 사용자를 is_verified=True로 업데이트
    """
    db = SessionLocal()
    try:
        # 기존 사용자 수 확인
        unverified_count = db.query(User).filter(User.is_verified == False).count()
        print(f"[Verify] Found {unverified_count} unverified users")
        
        if unverified_count == 0:
            print("[Verify] No unverified users found. All users are already verified.")
            return
        
        # 모든 미인증 사용자를 인증 처리
        result = db.execute(
            text("UPDATE users SET is_verified = 1 WHERE is_verified = 0")
        )
        db.commit()
        
        verified_count = result.rowcount
        print(f"[Verify] ✓ Successfully verified {verified_count} existing users")
        print(f"[Verify] These users can now log in without email verification")
        
    except Exception as e:
        db.rollback()
        print(f"[Verify] ✗ Error verifying users: {e}")
        import traceback
        print(traceback.format_exc())
        raise
    finally:
        db.close()

if __name__ == "__main__":
    print("=" * 70)
    print("기존 사용자 일괄 인증 처리")
    print("=" * 70)
    print()
    print("이 스크립트는 이메일 인증 기능 추가 전에 생성된 사용자들을")
    print("자동으로 인증 처리합니다.")
    print()
    
    confirm = input("계속하시겠습니까? (y/N): ").strip().lower()
    if confirm != 'y':
        print("취소되었습니다.")
        sys.exit(0)
    
    print()
    verify_existing_users()
    print()
    print("=" * 70)
    print("완료")
    print("=" * 70)

