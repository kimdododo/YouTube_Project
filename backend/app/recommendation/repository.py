"""
추천용 데이터 조회 레이어
가능하면 하나의 조인 쿼리에서 점수 계산에 필요한 칼럼을 모두 가져온다.
테이블 명은 파이프라인에서 생성될 테이블을 가정한다.

  - comment_sentiment(video_id, sentiment_label, sentiment_score, inferred_at)
  - video_sentiment_agg(video_id, pos_ratio, neg_ratio, avg_score, updated_at)
  - video_topics(video_id, topic_id, topic_score)
  - videos(video_id, title, channel_id, views, published_at, thumbnail_url ...)

스키마 차이가 있어도 SELECT 별칭으로 필드를 통일해서 올려준다.
"""
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import text


def fetch_rank_candidates(
    db: Session,
    limit: int = 20,
    topic_id: Optional[int] = None,
) -> List[Dict[str, Any]]:
    """추천 랭킹 후보를 조회한다.

    MySQL 호환. 점수 계산은 애플리케이션 레벨에서 수행(유연성 확보).
    """
    params: Dict[str, Any] = {"limit": limit}

    # topic_id가 지정되면 해당 토픽 우선으로 필터(너무 좁다면 LEFT JOIN 전체도 가능)
    topic_filter = ""
    if topic_id is not None:
        topic_filter = "WHERE t.topic_id = :topic_id"
        params["topic_id"] = int(topic_id)

    sql = text(
        f"""
        SELECT 
            v.video_id        AS video_id,
            v.title           AS title,
            v.channel_id      AS channel_id,
            v.views           AS views,
            s.pos_ratio       AS pos_ratio,
            s.avg_score       AS avg_score,
            t.topic_id        AS topic_id,
            t.topic_score     AS topic_score
        FROM videos v
        JOIN video_sentiment_agg s ON v.video_id = s.video_id
        LEFT JOIN video_topics t    ON v.video_id = t.video_id
        {topic_filter}
        ORDER BY v.published_at DESC
        LIMIT :limit
        """
    )

    rows = db.execute(sql, params).mappings().all()
    return [dict(r) for r in rows]


def fetch_top_topics(db: Session, limit: int = 5) -> List[int]:
    """가장 인기 있는 토픽 ID 상위 N개를 반환 (간단 합계 기반)."""
    sql = text(
        """
        SELECT t.topic_id
        FROM video_topics t
        GROUP BY t.topic_id
        ORDER BY SUM(t.topic_score) DESC
        LIMIT :limit
        """
    )
    rows = db.execute(sql, {"limit": limit}).all()
    return [int(r[0]) for r in rows]


