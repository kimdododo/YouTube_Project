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
    # User 테이블에 is_verified 컬럼 추가 (이미 존재하는 경우 스킵)
    from sqlalchemy import inspect
    from sqlalchemy.engine import reflection
    from sqlalchemy.exc import OperationalError
    
    conn = op.get_bind()
    inspector = inspect(conn)
    
    # is_verified 컬럼 추가 시도 (이미 존재하면 무시)
    try:
        columns = [col['name'] for col in inspector.get_columns('users')]
        if 'is_verified' not in columns:
            op.add_column('users', sa.Column('is_verified', sa.Boolean(), nullable=False, server_default='0'))
            print("[Migration] Added 'is_verified' column to 'users' table")
        else:
            print("[Migration] Column 'is_verified' already exists in 'users' table, skipping...")
    except OperationalError as e:
        # 컬럼이 이미 존재하는 경우 (1060 에러)
        if 'Duplicate column name' in str(e) or '1060' in str(e):
            print("[Migration] Column 'is_verified' already exists (caught exception), skipping...")
        else:
            raise
    
    # 인덱스 생성 시도 (이미 존재하면 무시)
    try:
        indexes = [idx['name'] for idx in inspector.get_indexes('users')]
        if 'ix_users_is_verified' not in indexes:
            op.create_index(op.f('ix_users_is_verified'), 'users', ['is_verified'], unique=False)
            print("[Migration] Created index 'ix_users_is_verified'")
        else:
            print("[Migration] Index 'ix_users_is_verified' already exists, skipping...")
    except OperationalError as e:
        # 인덱스가 이미 존재하는 경우
        if 'Duplicate key name' in str(e) or '1061' in str(e):
            print("[Migration] Index 'ix_users_is_verified' already exists (caught exception), skipping...")
        else:
            raise
    
    # email_verifications 테이블 생성 (이미 존재하는 경우 스킵)
    try:
        tables = inspector.get_table_names()
        if 'email_verifications' not in tables:
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
            print("[Migration] Created 'email_verifications' table")
            
            # 인덱스 생성
            try:
                op.create_index(op.f('ix_email_verifications_user_id'), 'email_verifications', ['user_id'], unique=False)
            except OperationalError as e:
                if 'Duplicate key name' not in str(e) and '1061' not in str(e):
                    raise
            
            try:
                op.create_index(op.f('ix_email_verifications_code'), 'email_verifications', ['code'], unique=False)
            except OperationalError as e:
                if 'Duplicate key name' not in str(e) and '1061' not in str(e):
                    raise
            
            try:
                op.create_index(op.f('ix_email_verifications_expires_at'), 'email_verifications', ['expires_at'], unique=False)
            except OperationalError as e:
                if 'Duplicate key name' not in str(e) and '1061' not in str(e):
                    raise
            
            try:
                op.create_index(op.f('ix_email_verifications_is_used'), 'email_verifications', ['is_used'], unique=False)
            except OperationalError as e:
                if 'Duplicate key name' not in str(e) and '1061' not in str(e):
                    raise
            
            try:
                op.create_index('idx_user_unused', 'email_verifications', ['user_id', 'is_used'], unique=False)
            except OperationalError as e:
                if 'Duplicate key name' not in str(e) and '1061' not in str(e):
                    raise
        else:
            print("[Migration] Table 'email_verifications' already exists, skipping...")
            # 인덱스 확인 및 생성 (안전하게)
            ev_indexes = [idx['name'] for idx in inspector.get_indexes('email_verifications')]
            
            if 'ix_email_verifications_user_id' not in ev_indexes:
                try:
                    op.create_index(op.f('ix_email_verifications_user_id'), 'email_verifications', ['user_id'], unique=False)
                except OperationalError:
                    pass
            
            if 'ix_email_verifications_code' not in ev_indexes:
                try:
                    op.create_index(op.f('ix_email_verifications_code'), 'email_verifications', ['code'], unique=False)
                except OperationalError:
                    pass
            
            if 'ix_email_verifications_expires_at' not in ev_indexes:
                try:
                    op.create_index(op.f('ix_email_verifications_expires_at'), 'email_verifications', ['expires_at'], unique=False)
                except OperationalError:
                    pass
            
            if 'ix_email_verifications_is_used' not in ev_indexes:
                try:
                    op.create_index(op.f('ix_email_verifications_is_used'), 'email_verifications', ['is_used'], unique=False)
                except OperationalError:
                    pass
            
            if 'idx_user_unused' not in ev_indexes:
                try:
                    op.create_index('idx_user_unused', 'email_verifications', ['user_id', 'is_used'], unique=False)
                except OperationalError:
                    pass
    except OperationalError as e:
        # 테이블이 이미 존재하는 경우
        if 'already exists' in str(e) or '1050' in str(e):
            print("[Migration] Table 'email_verifications' already exists (caught exception), skipping...")
        else:
            raise


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

