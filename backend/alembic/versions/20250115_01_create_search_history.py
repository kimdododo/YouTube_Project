"""create search_history table

Revision ID: 20250115_01
Revises: 
Create Date: 2025-01-15

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql

# revision identifiers, used by Alembic.
revision = '20250115_01'
down_revision = '20250213_01'  # 최신 마이그레이션
branch_labels = None
depends_on = None


def upgrade():
    # search_history 테이블 생성
    op.create_table(
        'search_history',
        sa.Column('id', sa.Integer(), nullable=False, autoincrement=True),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('query', sa.String(length=255), nullable=False, comment='검색어'),
        sa.Column('searched_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], name='fk_search_history_user_id', ondelete='CASCADE'),
        mysql_engine='InnoDB',
        mysql_charset='utf8mb4',
        mysql_collate='utf8mb4_unicode_ci'
    )
    
    # 인덱스 생성
    op.create_index(op.f('ix_search_history_id'), 'search_history', ['id'], unique=False)
    op.create_index(op.f('ix_search_history_user_id'), 'search_history', ['user_id'], unique=False)
    op.create_index(op.f('ix_search_history_searched_at'), 'search_history', ['searched_at'], unique=False)
    op.create_index('idx_user_searched_at', 'search_history', ['user_id', 'searched_at'], unique=False)


def downgrade():
    # 인덱스 삭제
    op.drop_index('idx_user_searched_at', table_name='search_history')
    op.drop_index(op.f('ix_search_history_searched_at'), table_name='search_history')
    op.drop_index(op.f('ix_search_history_user_id'), table_name='search_history')
    op.drop_index(op.f('ix_search_history_id'), table_name='search_history')
    
    # 테이블 삭제
    op.drop_table('search_history')

