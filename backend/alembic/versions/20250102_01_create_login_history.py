"""create login_history table

Revision ID: 20250102_01
Revises: 20250101_01
Create Date: 2025-01-02 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql

# revision identifiers, used by Alembic.
revision = '20250102_01'
down_revision = '20250101_01'
branch_labels = None
depends_on = None


def upgrade():
    # login_history 테이블 생성
    op.create_table(
        'login_history',
        sa.Column('id', sa.Integer(), nullable=False, autoincrement=True),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('login_time', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('ip_address', sa.String(length=45), nullable=True, comment='로그인 IP 주소'),
        sa.Column('user_agent', sa.String(length=500), nullable=True, comment='사용자 에이전트 (브라우저 정보)'),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], name='fk_login_history_user_id')
    )
    # 인덱스 생성
    op.create_index(op.f('ix_login_history_id'), 'login_history', ['id'], unique=False)
    op.create_index(op.f('ix_login_history_user_id'), 'login_history', ['user_id'], unique=False)
    op.create_index(op.f('ix_login_history_login_time'), 'login_history', ['login_time'], unique=False)


def downgrade():
    # 인덱스 삭제
    op.drop_index(op.f('ix_login_history_login_time'), table_name='login_history')
    op.drop_index(op.f('ix_login_history_user_id'), table_name='login_history')
    op.drop_index(op.f('ix_login_history_id'), table_name='login_history')
    # 테이블 삭제
    op.drop_table('login_history')

