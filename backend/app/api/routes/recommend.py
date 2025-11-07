from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional

from app.core.database import get_db
from app.recommendation.models import RankedVideo, RankedVideoList
from app.recommendation.ranking import compute_final_score
from app.recommendation.repository import fetch_rank_candidates, fetch_top_topics
from app.core.responses import ok
from app.core.auth import get_current_user_id

router = APIRouter(prefix="/api/v1/videos", tags=["recommendation"])


@router.get("/recommended")
def get_recommended(
    limit: int = Query(20, ge=1, le=100),
    topic_id: Optional[int] = Query(None, description="필터/가중치에 사용할 주제 ID"),
    db: Session = Depends(get_db),
):
    """감정 + 토픽 + 인기도를 결합한 랭킹 추천.

    배치 파이프라인에서 미리 집계된 테이블을 사용한다.
    """
    try:
        candidates = fetch_rank_candidates(db=db, limit=limit * 5, topic_id=topic_id)
        if not candidates:
            return RankedVideoList(videos=[], total=0, message="no candidates")

        # 점수 계산 후 상위 limit 추출
        ranked = []
        for row in candidates:
            score = compute_final_score(
                pos_ratio=row.get("pos_ratio"),
                avg_score=row.get("avg_score"),
                topic_score=row.get("topic_score"),
                video_topic_id=row.get("topic_id"),
                target_topic_id=topic_id,
                views=row.get("views"),
            )
            ranked.append({
                "video_id": row["video_id"],
                "title": row.get("title") or "",
                "channel_id": row.get("channel_id") or "",
                "score": score,
                "pos_ratio": row.get("pos_ratio"),
                "topic_id": row.get("topic_id"),
            })

        ranked.sort(key=lambda x: x["score"], reverse=True)
        topn = ranked[:limit]
        payload = RankedVideoList(videos=[RankedVideo(**v) for v in topn], total=len(topn)).model_dump()
        return ok(payload).model_dump()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"recommendation failed: {e}")


@router.get("/personalized")
def get_personalized(
    limit: int = Query(20, ge=1, le=100),
    recent_topic_id: Optional[int] = Query(None, description="사용자가 최근 본 토픽(더미)"),
    db: Session = Depends(get_db),
    user_id: str = Depends(get_current_user_id),
):
    """간단한 더미 개인화 버전.

    - user_features가 아직 없으므로 최근 본 토픽(recent_topic_id)이나
      전체 인기 토픽 상위 1개를 target_topic으로 두고 동일 점수식으로 랭킹한다.
    - 추후 user_features가 생기면 compute_final_score 호출 시 user_affinity만 가중치로 추가하면 됨.
    """
    try:
        target = recent_topic_id
        if target is None:
            popular = fetch_top_topics(db, limit=1)
            target = popular[0] if popular else None

        candidates = fetch_rank_candidates(db=db, limit=limit * 5, topic_id=target)
        if not candidates:
            return RankedVideoList(videos=[], total=0, message="no candidates")

        ranked = []
        for row in candidates:
            score = compute_final_score(
                pos_ratio=row.get("pos_ratio"),
                avg_score=row.get("avg_score"),
                topic_score=row.get("topic_score"),
                video_topic_id=row.get("topic_id"),
                target_topic_id=target,
                views=row.get("views"),
                # user_affinity 자리(향후 user_features 조인 후 값 전달)
            )
            ranked.append({
                "video_id": row["video_id"],
                "title": row.get("title") or "",
                "channel_id": row.get("channel_id") or "",
                "score": score,
                "pos_ratio": row.get("pos_ratio"),
                "topic_id": row.get("topic_id"),
            })

        ranked.sort(key=lambda x: x["score"], reverse=True)
        topn = ranked[:limit]
        payload = RankedVideoList(videos=[RankedVideo(**v) for v in topn], total=len(topn)).model_dump()
        return ok(payload).model_dump()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"personalized failed: {e}")


