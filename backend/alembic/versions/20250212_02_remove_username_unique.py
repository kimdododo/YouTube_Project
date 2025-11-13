"""remove username unique constraint

Revision ID: 20250212_02
Revises: 20250212_01
Create Date: 2025-02-12 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '20250212_02'
down_revision = '20250212_01'
branch_labels = None
depends_on = None


def upgrade():
    # username의 unique 제약 제거 (동명이인 허용)
    # 먼저 unique 인덱스가 있는지 확인하고 제거
    try:
        op.drop_index('ix_users_username', table_name='users')
    except Exception:
        pass  # 인덱스가 없을 수 있음
    
    # unique 제약 제거 (MySQL의 경우)
    try:
        op.drop_constraint('users_username_key', 'users', type_='unique')
    except Exception:
        pass  # 제약이 없을 수 있음
    
    # 일반 인덱스 재생성 (unique 없이)
    op.create_index('ix_users_username', 'users', ['username'], unique=False)


def downgrade():
    # unique 인덱스로 복원
    op.drop_index('ix_users_username', table_name='users')
    op.create_index('ix_users_username', 'users', ['username'], unique=True)

