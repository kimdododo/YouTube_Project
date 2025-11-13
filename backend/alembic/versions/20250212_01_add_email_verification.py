"""add email verification

Revision ID: 20250212_01
Revises: 20250211_01
Create Date: 2025-02-12 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql

# revision identifiers, used by Alembic.
revision = '20250212_01'
down_revision = '20250211_01'
branch_labels = None
depends_on = None


def upgrade():
    # User 테이블에 is_verified 컬럼 추가
    op.add_column('users', sa.Column('is_verified', sa.Boolean(), nullable=False, server_default='0'))
    op.create_index(op.f('ix_users_is_verified'), 'users', ['is_verified'], unique=False)
    
    # email_verifications 테이블 생성
    op.create_table(
        'email_verifications',
        sa.Column('id', sa.Integer(), nullable=False, autoincrement=True),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('code', sa.String(length=10), nullable=False),
        sa.Column('expires_at', sa.DateTime(), nullable=False),
        sa.Column('is_used', sa.Boolean(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_email_verifications_user_id'), 'email_verifications', ['user_id'], unique=False)
    op.create_index(op.f('ix_email_verifications_code'), 'email_verifications', ['code'], unique=False)
    op.create_index(op.f('ix_email_verifications_expires_at'), 'email_verifications', ['expires_at'], unique=False)
    op.create_index(op.f('ix_email_verifications_is_used'), 'email_verifications', ['is_used'], unique=False)
    op.create_index('idx_user_unused', 'email_verifications', ['user_id', 'is_used'], unique=False)


def downgrade():
    # email_verifications 테이블 삭제
    op.drop_index('idx_user_unused', table_name='email_verifications')
    op.drop_index(op.f('ix_email_verifications_is_used'), table_name='email_verifications')
    op.drop_index(op.f('ix_email_verifications_expires_at'), table_name='email_verifications')
    op.drop_index(op.f('ix_email_verifications_code'), table_name='email_verifications')
    op.drop_index(op.f('ix_email_verifications_user_id'), table_name='email_verifications')
    op.drop_table('email_verifications')
    
    # User 테이블에서 is_verified 컬럼 제거
    op.drop_index(op.f('ix_users_is_verified'), table_name='users')
    op.drop_column('users', 'is_verified')

