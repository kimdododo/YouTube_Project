"""create search_history table

Revision ID: 20250115_01
Revises: 20250103_01
Create Date: 2025-01-15 00:00:00
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20250115_01"
down_revision = "20250103_01"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """
    Create search_history table used to store user search queries.
    """
    op.create_table(
        "search_history",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("query", sa.String(length=255), nullable=False),
        sa.Column("searched_at", sa.DateTime(), server_default=sa.func.now(), nullable=False),
    )

    # Additional helpful indexes
    op.create_index("ix_search_history_user_id", "search_history", ["user_id"])
    op.create_index("idx_user_searched_at", "search_history", ["user_id", "searched_at"])


def downgrade() -> None:
    """
    Drop search_history table.
    """
    op.drop_index("idx_user_searched_at", table_name="search_history")
    op.drop_index("ix_search_history_user_id", table_name="search_history")
    op.drop_table("search_history")


