"""
개인화 점수 캐싱 서비스
Redis를 사용한 user_pref, video_static, personalized_score 캐싱
"""
import json
import logging
from typing import Optional, Dict, Any
from app.core.redis_client import get_redis
from app.crud.user_preference import get_user_preference
from app.crud.video_static import get_video_static
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)


def get_user_pref_cache(db: Session, user_id: int) -> Optional[Dict[str, Any]]:
    """
    사용자 취향 정보 조회 (Redis 캐시 우선)
    
    Args:
        db: 데이터베이스 세션
        user_id: 사용자 ID
    
    Returns:
        사용자 취향 정보 딕셔너리 또는 None
    """
    # Redis 캐시 확인 (실패해도 계속 진행)
    try:
        redis_client = get_redis()
        cache_key = f"user_pref:{user_id}"
        cached = redis_client.get(cache_key)
        if cached:
            return json.loads(cached)
    except Exception as e:
        logger.warning(f"[Cache] Redis get failed for user_pref:{user_id}: {e}, falling back to DB")
    
    # DB에서 조회
    try:
        pref = get_user_preference(db, user_id)
        if not pref:
            return None
        
        # 딕셔너리로 변환
        pref_dict = {
            "user_id": pref.user_id,
            "embedding": pref.embedding,
            "topics": pref.topics,
            "sentiment_weight": pref.sentiment_weight
        }
        
        # Redis에 캐싱 (실패해도 계속 진행)
        try:
            redis_client = get_redis()
            cache_key = f"user_pref:{user_id}"
            redis_client.set(cache_key, json.dumps(pref_dict))
        except Exception as e:
            logger.warning(f"[Cache] Redis set failed for user_pref:{user_id}: {e}")
        
        return pref_dict
    except Exception as e:
        logger.error(f"[Cache] DB query failed for user_pref:{user_id}: {e}")
        return None


def get_video_static_cache(db: Session, video_id: str) -> Optional[Dict[str, Any]]:
    """
    비디오 정적 정보 조회 (Redis 캐시 우선)
    
    Args:
        db: 데이터베이스 세션
        video_id: 비디오 ID
    
    Returns:
        비디오 정적 정보 딕셔너리 또는 None
    """
    # Redis 캐시 확인 (실패해도 계속 진행)
    try:
        redis_client = get_redis()
        cache_key = f"vid_static:{video_id}"
        cached = redis_client.get(cache_key)
        if cached:
            return json.loads(cached)
    except Exception as e:
        logger.warning(f"[Cache] Redis get failed for vid_static:{video_id}: {e}, falling back to DB")
    
    # DB에서 조회
    try:
        static = get_video_static(db, video_id)
        if not static:
            return None
        
        # 딕셔너리로 변환
        static_dict = {
            "video_id": static.video_id,
            "summary": static.summary,
            "sentiment": static.sentiment,
            "topics": static.topics,
            "embedding": static.embedding
        }
        
        # Redis에 캐싱 (실패해도 계속 진행)
        try:
            redis_client = get_redis()
            cache_key = f"vid_static:{video_id}"
            redis_client.set(cache_key, json.dumps(static_dict))
        except Exception as e:
            logger.warning(f"[Cache] Redis set failed for vid_static:{video_id}: {e}")
        
        return static_dict
    except Exception as e:
        logger.error(f"[Cache] DB query failed for vid_static:{video_id}: {e}")
        return None


def get_personalized_cache(user_id: int, video_id: str) -> Optional[Dict[str, Any]]:
    """
    개인화 점수 조회 (Redis 캐시)
    
    Args:
        user_id: 사용자 ID
        video_id: 비디오 ID
    
    Returns:
        개인화 점수 딕셔너리 또는 None
    """
    try:
        redis_client = get_redis()
        cache_key = f"pref_score:{user_id}:{video_id}"
        cached = redis_client.get(cache_key)
        if cached:
            return json.loads(cached)
    except Exception as e:
        logger.warning(f"[Cache] Redis get failed for pref_score:{user_id}:{video_id}: {e}")
    
    return None


def set_personalized_cache(user_id: int, video_id: str, score_data: Dict[str, Any]):
    """
    개인화 점수 저장 (Redis 캐시)
    
    Args:
        user_id: 사용자 ID
        video_id: 비디오 ID
        score_data: 점수 데이터 딕셔너리
    """
    try:
        redis_client = get_redis()
        cache_key = f"pref_score:{user_id}:{video_id}"
        # 1시간 TTL
        redis_client.set(cache_key, json.dumps(score_data), ex=3600)
    except Exception as e:
        logger.warning(f"[Cache] Redis set failed for pref_score:{user_id}:{video_id}: {e}")

