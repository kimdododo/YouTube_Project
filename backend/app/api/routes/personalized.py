"""
개인화 점수 API
"""
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.services.personalization_cache import (
    get_user_pref_cache,
    get_video_static_cache,
    get_personalized_cache,
    set_personalized_cache
)
from app.services.scoring import calculate_personalized_score
import logging
import traceback

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/personalized", tags=["personalized"])


@router.get("/{user_id}/{video_id}")
def get_personalized_score(
    user_id: int,
    video_id: str,
    db: Session = Depends(get_db)
):
    """
    개인화 점수 조회
    
    Args:
        user_id: 사용자 ID
        video_id: 비디오 ID
    
    Returns:
        개인화 점수 정보
    """
    try:
        # 1. Redis 캐시 확인
        try:
            cached_score = get_personalized_cache(user_id, video_id)
            if cached_score:
                return cached_score
        except Exception as e:
            logger.warning(f"[Personalized] Redis cache check failed: {e}, continuing with DB lookup")
        
        # 2. 사용자 취향 정보 조회
        user_pref = get_user_pref_cache(db, user_id)
        if not user_pref:
            # 데이터가 없으면 기본값 반환
            logger.warning(f"[Personalized] User preference not found for user_id: {user_id}, returning default score")
            default_score = {
                "similarity": 0.0,
                "topic_score": 0.0,
                "sentiment_adjust": 1.0,
                "final_score": 0.0
            }
            return default_score
        
        # 3. 비디오 정적 정보 조회
        video_static = get_video_static_cache(db, video_id)
        if not video_static:
            # 데이터가 없으면 기본값 반환
            logger.warning(f"[Personalized] Video static not found for video_id: {video_id}, returning default score")
            default_score = {
                "similarity": 0.0,
                "topic_score": 0.0,
                "sentiment_adjust": 1.0,
                "final_score": 0.0
            }
            return default_score
        
        # 4. 개인화 점수 계산
        score_data = calculate_personalized_score(user_pref, video_static)
        
        # 5. Redis에 캐싱 (실패해도 계속 진행)
        try:
            set_personalized_cache(user_id, video_id, score_data)
        except Exception as e:
            logger.warning(f"[Personalized] Redis cache set failed: {e}, but returning score")
        
        return score_data
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[Personalized] Error calculating score for user_id={user_id}, video_id={video_id}: {e}")
        logger.error(f"[Personalized] Traceback: {traceback.format_exc()}")
        # 에러 발생 시 기본값 반환 (500 에러 대신)
        return {
            "similarity": 0.0,
            "topic_score": 0.0,
            "sentiment_adjust": 1.0,
            "final_score": 0.0,
            "error": f"Internal error: {str(e)}"
        }

