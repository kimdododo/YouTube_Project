"""create comment_sentiment_summaries table

Revision ID: 20250120_01
Revises: 20250115_01
Create Date: 2025-01-20 00:00:00
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql


# revision identifiers, used by Alembic.
revision = "20250120_01"
down_revision = "20250115_01"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """
    Create comment_sentiment_summaries table for caching sentiment analysis results.
    """
    op.create_table(
        "comment_sentiment_summaries",
        sa.Column("video_id", sa.String(length=64), primary_key=True, nullable=False, comment='비디오 ID'),
        sa.Column("positive_ratio", sa.Float(), nullable=False, comment='긍정 비율 (0.0-1.0)'),
        sa.Column("negative_ratio", sa.Float(), nullable=False, comment='부정 비율 (0.0-1.0)'),
        sa.Column("positive_keywords", mysql.JSON(), nullable=False, comment='긍정 키워드 리스트'),
        sa.Column("negative_keywords", mysql.JSON(), nullable=False, comment='부정 키워드 리스트'),
        sa.Column("analyzed_comments_count", sa.Float(), nullable=False, server_default='0', comment='분석한 댓글 수'),
        sa.Column("model_name", sa.String(length=100), nullable=True, comment='사용된 LLM 모델명'),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False, comment='수정일시'),
    )

    # Indexes
    op.create_index("idx_video_updated", "comment_sentiment_summaries", ["video_id", "updated_at"])


def downgrade() -> None:
    """
    Drop comment_sentiment_summaries table.
    """
    op.drop_index("idx_video_updated", table_name="comment_sentiment_summaries")
    op.drop_table("comment_sentiment_summaries")

