"""
개인화 추천 API 라우터
SimCSE 임베딩 기반 개인화 추천
"""
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session
from typing import List, Optional
import logging
import jwt

from app.core.database import get_db
from app.core.auth import get_current_user_id
from app.core.config import JWT_SECRET, JWT_ALGO
from app.crud import persona as crud_persona
from app.crud import video as crud_video
from app.models.video import Video
from app.models.channel import Channel

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/recommendations", tags=["recommendations"])


def get_user_id_optional(request: Request, user_id: Optional[int] = None) -> Optional[int]:
    """
    JWT 토큰에서 user_id 추출 시도 (선택적)
    """
    if user_id:
        return user_id
    
    try:
        # Authorization 헤더 확인
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
            try:
                payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])
                sub = payload.get("sub")
                if sub:
                    return int(sub)
            except jwt.ExpiredSignatureError:
                logger.debug("[Personalized] JWT token expired")
            except jwt.InvalidTokenError:
                logger.debug("[Personalized] Invalid JWT token")
            except Exception as e:
                logger.debug(f"[Personalized] Error decoding JWT: {e}")
    except Exception as e:
        logger.debug(f"[Personalized] Error extracting user_id from JWT: {e}")
    
    return None


@router.get("/personalized")
def get_personalized_recommendations(
    request: Request,
    user_id: Optional[int] = Query(None, description="사용자 ID (쿼리 파라미터 또는 JWT에서 추출)"),
    limit: int = Query(20, ge=1, le=100, description="추천할 영상 수"),
    db: Session = Depends(get_db)
):
    """
    SimCSE 임베딩 기반 개인화 추천
    
    Args:
        request: FastAPI Request 객체 (JWT 토큰 추출용)
        user_id: 사용자 ID (쿼리 파라미터)
        limit: 추천할 영상 수
        db: 데이터베이스 세션
        
    Returns:
        개인화 추천 영상 리스트
    """
    try:
        # user_id 결정: 쿼리 파라미터 우선, 없으면 JWT에서 추출 시도
        if user_id is None:
            user_id = get_user_id_optional(request)
        
        if user_id is None:
            raise HTTPException(
                status_code=400,
                detail="user_id is required (query parameter or JWT token)"
            )
        
        logger.info(f"[Personalized] Getting recommendations for user {user_id}")
        
        # 1. 사용자 프로필 벡터 가져오기 또는 생성
        user_vector = crud_persona.get_or_create_user_persona_vector(db, user_id)
        
        if not user_vector:
            # Cold-start: 사용자 이벤트가 없음
            logger.info(f"[Personalized] Cold-start for user {user_id}, returning popular videos")
            # 기본 인기 영상으로 fallback
            popular_videos = crud_video.get_most_liked_videos(db, skip=0, limit=limit)
            
            items = []
            for video in popular_videos:
                # 채널 정보 조회
                channel = db.query(Channel).filter(Channel.id == video.channel_id).first()
                channel_title = channel.title if channel else "알 수 없음"
                
                items.append({
                    "video_id": video.id,
                    "title": video.title,
                    "thumbnail_url": video.thumbnail_url,
                    "channel_title": channel_title,
                    "similarity_score": None,
                    "reason": "아직 시청 기록이 적어서, 우선 인기 여행 영상을 추천해드릴게요."
                })
            
            return {
                "success": True,
                "user_id": user_id,
                "count": len(items),
                "items": items,
                "cold_start": True
            }
        
        # 2. 추천 후보 영상 조회
        candidate_videos = crud_persona.get_candidate_videos(db, limit=500)
        
        if not candidate_videos:
            logger.warning(f"[Personalized] No candidate videos found")
            return {
                "success": True,
                "user_id": user_id,
                "count": 0,
                "items": []
            }
        
        # 3. 각 후보 영상에 대해 유사도 계산
        scored_videos = []
        for video in candidate_videos:
            # 영상 임베딩 가져오기
            video_embedding = crud_persona.get_video_embedding(db, video)
            
            if not video_embedding:
                continue
            
            # 코사인 유사도 계산
            similarity = crud_persona.calculate_cosine_similarity(
                user_vector,
                video_embedding
            )
            
            scored_videos.append({
                "video": video,
                "similarity": similarity
            })
        
        # 4. 유사도 기준으로 정렬 후 상위 K개 선택
        scored_videos.sort(key=lambda x: x["similarity"], reverse=True)
        top_videos = scored_videos[:limit]
        
        # 5. 응답 형식으로 변환
        items = []
        for item in top_videos:
            video = item["video"]
            similarity = item["similarity"]
            
            # 채널 정보 조회
            channel = db.query(Channel).filter(Channel.id == video.channel_id).first()
            channel_title = channel.title if channel else "알 수 없음"
            
            # 추천 이유 생성
            if similarity >= 0.8:
                reason = "최근에 본 여행 영상과 매우 유사한 콘텐츠입니다."
            elif similarity >= 0.6:
                reason = "최근에 본 여행 영상과 분위기가 비슷합니다."
            else:
                reason = "당신의 취향과 관련된 여행 영상입니다."
            
            items.append({
                "video_id": video.id,
                "title": video.title,
                "thumbnail_url": video.thumbnail_url,
                "channel_title": channel_title,
                "similarity_score": round(similarity, 4),
                "reason": reason
            })
        
        logger.info(f"[Personalized] Generated {len(items)} recommendations for user {user_id}")
        
        return {
            "success": True,
            "user_id": user_id,
            "count": len(items),
            "items": items,
            "cold_start": False
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[Personalized] Error generating recommendations: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate personalized recommendations: {str(e)}"
        )

