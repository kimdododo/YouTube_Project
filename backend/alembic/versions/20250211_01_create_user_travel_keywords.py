"""create user_travel_keywords table

Revision ID: 20250211_01
Revises: 20250103_01
Create Date: 2025-02-11 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '20250211_01'
down_revision = '20250103_01'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = inspector.get_table_names()
    users_exists = 'users' in existing_tables

    columns = [
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True, nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('keyword', sa.String(length=64), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'), nullable=False),
    ]

    constraints = [
        sa.UniqueConstraint('user_id', 'keyword', name='uq_user_keyword')
    ]

    if users_exists:
        constraints.append(
            sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE')
        )

    op.create_table(
        'user_travel_keywords',
        *columns,
        *constraints
    )
    op.create_index(op.f('ix_user_travel_keywords_id'), 'user_travel_keywords', ['id'], unique=False)
    op.create_index(op.f('ix_user_travel_keywords_user_id'), 'user_travel_keywords', ['user_id'], unique=False)


def downgrade():
    op.drop_index(op.f('ix_user_travel_keywords_user_id'), table_name='user_travel_keywords')
    op.drop_index(op.f('ix_user_travel_keywords_id'), table_name='user_travel_keywords')
    op.drop_table('user_travel_keywords')



