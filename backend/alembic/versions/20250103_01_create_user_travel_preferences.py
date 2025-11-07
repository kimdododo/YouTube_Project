"""create user_travel_preferences table

Revision ID: 20250103_01
Revises: 20250102_01
Create Date: 2025-01-03 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql

# revision identifiers, used by Alembic.
revision = '20250103_01'
down_revision = '20250102_01'
branch_labels = None
depends_on = None


def upgrade():
    # user_travel_preferences 테이블 생성
    op.create_table(
        'user_travel_preferences',
        sa.Column('id', sa.Integer(), nullable=False, autoincrement=True),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('preference_id', sa.Integer(), nullable=False, comment='여행 취향 ID (1-11)'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'preference_id', name='uq_user_preference'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE')
    )
    # 인덱스 생성
    op.create_index(op.f('ix_user_travel_preferences_id'), 'user_travel_preferences', ['id'], unique=False)
    op.create_index(op.f('ix_user_travel_preferences_user_id'), 'user_travel_preferences', ['user_id'], unique=False)


def downgrade():
    # 인덱스 삭제
    op.drop_index(op.f('ix_user_travel_preferences_user_id'), table_name='user_travel_preferences')
    op.drop_index(op.f('ix_user_travel_preferences_id'), table_name='user_travel_preferences')
    # 테이블 삭제
    op.drop_table('user_travel_preferences')

