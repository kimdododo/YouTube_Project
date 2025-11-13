"""verify existing users

Revision ID: 20250213_01
Revises: 20250212_02
Create Date: 2025-02-13 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text

# revision identifiers, used by Alembic.
revision = '20250213_01'
down_revision = '20250212_02'
branch_labels = None
depends_on = None


def upgrade():
    """
    이메일 인증 기능 추가 전에 생성된 기존 사용자들을 자동으로 인증 처리
    이메일 인증 기능이 2025-02-12에 추가되었으므로, 그 이전에 생성된 사용자들은
    이미 이메일로 가입했으므로 인증된 것으로 간주
    """
    # 기존 사용자들(is_verified=False)을 모두 is_verified=True로 업데이트
    # 이메일 인증 기능 추가 전에 가입한 사용자들은 이미 이메일로 가입했으므로 인증된 것으로 처리
    op.execute(
        text("""
            UPDATE users 
            SET is_verified = 1 
            WHERE is_verified = 0
        """)
    )
    
    print("[Migration] Verified all existing users (set is_verified=True for users created before email verification feature)")


def downgrade():
    """
    다운그레이드 시에는 기존 사용자들의 인증 상태를 되돌릴 수 없으므로
    아무 작업도 하지 않음 (데이터 손실 방지)
    """
    pass

