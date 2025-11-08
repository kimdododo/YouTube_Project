"""create login_history table

Revision ID: 20250102_01
Revises: None
Create Date: 2025-01-02 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql

# revision identifiers, used by Alembic.
revision = '20250102_01'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    # users 테이블 존재 여부 확인
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = inspector.get_table_names()
    users_exists = 'users' in existing_tables
    
    # login_history 테이블 생성
    if users_exists:
        # users 테이블이 존재하면 외래 키 포함
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
    else:
        # users 테이블이 없으면 외래 키 없이 생성
        op.create_table(
            'login_history',
            sa.Column('id', sa.Integer(), nullable=False, autoincrement=True),
            sa.Column('user_id', sa.Integer(), nullable=False),
            sa.Column('login_time', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
            sa.Column('ip_address', sa.String(length=45), nullable=True, comment='로그인 IP 주소'),
            sa.Column('user_agent', sa.String(length=500), nullable=True, comment='사용자 에이전트 (브라우저 정보)'),
            sa.PrimaryKeyConstraint('id')
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

