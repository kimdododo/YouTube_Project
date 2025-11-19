"""
비디오 정적 정보 조회 API
"""
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.services.personalization_cache import get_video_static_cache
import logging
import traceback

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/videos", tags=["videos"])


@router.get("/{video_id}/static")
def get_video_static_info(
    video_id: str,
    db: Session = Depends(get_db)
):
    """
    비디오 정적 정보 조회 (summary, sentiment, topics, embedding)
    
    Args:
        video_id: 비디오 ID
    
    Returns:
        비디오 정적 정보
    """
    try:
        static_info = get_video_static_cache(db, video_id)
        
        if not static_info:
            # 데이터가 없으면 기본값 반환
            logger.warning(f"[VideoStatic] Video static not found for video_id: {video_id}, returning default values")
            return {
                "video_id": video_id,
                "summary": None,
                "sentiment": 0.5,
                "topics": {},
                "embedding": None
            }
        
        return static_info
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[VideoStatic] Error fetching static info for video_id={video_id}: {e}")
        logger.error(f"[VideoStatic] Traceback: {traceback.format_exc()}")
        # 에러 발생 시 기본값 반환
        return {
            "video_id": video_id,
            "summary": None,
            "sentiment": 0.5,
            "topics": {},
            "embedding": None,
            "error": f"Internal error: {str(e)}"
        }

