"""
사용자 프로필 벡터 관련 CRUD 작업
"""
from sqlalchemy.orm import Session
from sqlalchemy import and_, desc
from typing import Optional, List
from datetime import datetime, timedelta
import numpy as np
import json
import logging

from app.models.user_persona import UserPersonaVector
from app.models.user_video_event import UserVideoEvent
from app.models.video import Video
from app.models.video_static import VideoStatic
from app.core.embeddings import get_embeddings_batch_sync

logger = logging.getLogger(__name__)

# 설정 상수
MAX_USER_EVENTS = 50  # 사용자 프로필 생성에 사용할 최대 이벤트 수
CACHE_EXPIRY_HOURS = 24  # 프로필 벡터 캐시 유효 시간 (시간)
CANDIDATE_VIDEO_LIMIT = 500  # 추천 후보 영상 수


def get_user_recent_events(
    db: Session, 
    user_id: int, 
    limit: int = MAX_USER_EVENTS
) -> List[UserVideoEvent]:
    """
    사용자의 최근 시청/좋아요 이벤트 조회
    
    Args:
        db: 데이터베이스 세션
        user_id: 사용자 ID
        limit: 최대 조회 개수
        
    Returns:
        이벤트 리스트 (좋아요 우선, 시청 시간 많은 순)
    """
    try:
        events = db.query(UserVideoEvent).filter(
            and_(
                UserVideoEvent.user_id == user_id,
                UserVideoEvent.event_type.in_(['watch', 'like'])
            )
        ).order_by(
            desc(UserVideoEvent.liked),  # 좋아요 우선
            desc(UserVideoEvent.watch_time),  # 시청 시간 많은 순
            desc(UserVideoEvent.created_at)  # 최근 순
        ).limit(limit).all()
        
        return events
    except Exception as e:
        logger.error(f"[Persona] Error getting user events: {e}", exc_info=True)
        return []


def get_user_persona_vector(
    db: Session, 
    user_id: int
) -> Optional[List[float]]:
    """
    사용자 프로필 벡터 조회 (캐시된 것)
    
    Args:
        db: 데이터베이스 세션
        user_id: 사용자 ID
        
    Returns:
        임베딩 벡터 또는 None
    """
    try:
        persona = db.query(UserPersonaVector).filter(
            UserPersonaVector.user_id == user_id
        ).first()
        
        if persona:
            # 캐시 유효 시간 확인
            expiry_time = persona.updated_at + timedelta(hours=CACHE_EXPIRY_HOURS)
            if datetime.utcnow() < expiry_time:
                return persona.embedding_json
            else:
                logger.info(f"[Persona] User {user_id} persona vector cache expired")
        
        return None
    except Exception as e:
        logger.error(f"[Persona] Error getting persona vector: {e}", exc_info=True)
        return None


def create_user_persona_vector(
    db: Session,
    user_id: int,
    events: List[UserVideoEvent]
) -> Optional[List[float]]:
    """
    사용자 프로필 벡터 생성 (최근 이벤트 기반)
    
    Args:
        db: 데이터베이스 세션
        user_id: 사용자 ID
        events: 사용자 이벤트 리스트
        
    Returns:
        임베딩 벡터 또는 None
    """
    if not events:
        logger.warning(f"[Persona] No events for user {user_id}")
        return None
    
    try:
        # 이벤트에서 video_id 추출
        video_ids = [event.video_id for event in events]
        
        # 영상 정보 조회
        videos = db.query(Video).filter(Video.id.in_(video_ids)).all()
        
        if not videos:
            logger.warning(f"[Persona] No videos found for user {user_id} events")
            return None
        
        # 텍스트 생성: "제목: {title} 설명: {description}"
        texts = []
        for video in videos:
            title = video.title or ""
            description = video.description or ""
            text = f"제목: {title} 설명: {description}".strip()
            if text:
                texts.append(text)
        
        if not texts:
            logger.warning(f"[Persona] No valid texts for user {user_id}")
            return None
        
        # SimCSE 서버에서 임베딩 가져오기
        logger.info(f"[Persona] Getting embeddings for {len(texts)} videos (user {user_id})")
        embeddings = get_embeddings_batch_sync(texts)
        
        if not embeddings or len(embeddings) == 0:
            logger.error(f"[Persona] Failed to get embeddings for user {user_id}")
            return None
        
        # Mean pooling: 모든 임베딩의 평균
        embeddings_array = np.array(embeddings)
        mean_vector = np.mean(embeddings_array, axis=0).tolist()
        
        # DB에 저장 (upsert)
        persona = db.query(UserPersonaVector).filter(
            UserPersonaVector.user_id == user_id
        ).first()
        
        if persona:
            persona.embedding_json = mean_vector
            persona.updated_at = datetime.utcnow()
        else:
            persona = UserPersonaVector(
                user_id=user_id,
                embedding_json=mean_vector
            )
            db.add(persona)
        
        db.commit()
        logger.info(f"[Persona] Created/updated persona vector for user {user_id}")
        
        return mean_vector
        
    except Exception as e:
        logger.error(f"[Persona] Error creating persona vector: {e}", exc_info=True)
        db.rollback()
        return None


def get_or_create_user_persona_vector(
    db: Session,
    user_id: int
) -> Optional[List[float]]:
    """
    사용자 프로필 벡터 가져오기 또는 생성
    
    Args:
        db: 데이터베이스 세션
        user_id: 사용자 ID
        
    Returns:
        임베딩 벡터 또는 None
    """
    # 캐시된 벡터 확인
    cached_vector = get_user_persona_vector(db, user_id)
    if cached_vector:
        return cached_vector
    
    # 최근 이벤트 조회
    events = get_user_recent_events(db, user_id)
    if not events:
        return None
    
    # 프로필 벡터 생성
    return create_user_persona_vector(db, user_id, events)


def get_candidate_videos(
    db: Session,
    limit: int = CANDIDATE_VIDEO_LIMIT
) -> List[Video]:
    """
    추천 후보 영상 조회 (최근 업로드 또는 인기순)
    
    Args:
        db: 데이터베이스 세션
        limit: 최대 개수
        
    Returns:
        영상 리스트
    """
    try:
        # 최근 업로드된 영상 상위 N개
        videos = db.query(Video).filter(
            Video.published_at.isnot(None)
        ).order_by(
            desc(Video.published_at)
        ).limit(limit).all()
        
        return videos
    except Exception as e:
        logger.error(f"[Persona] Error getting candidate videos: {e}", exc_info=True)
        return []


def get_video_embedding(
    db: Session,
    video: Video
) -> Optional[List[float]]:
    """
    영상 임베딩 가져오기 (DB 캐시 우선, 없으면 생성)
    
    Args:
        db: 데이터베이스 세션
        video: Video 객체
        
    Returns:
        임베딩 벡터 또는 None
    """
    try:
        # videos_static 테이블에서 임베딩 확인
        video_static = db.query(VideoStatic).filter(
            VideoStatic.video_id == video.id
        ).first()
        
        if video_static and video_static.embedding:
            return video_static.embedding
        
        # 임베딩이 없으면 생성
        title = video.title or ""
        description = video.description or ""
        text = f"제목: {title} 설명: {description}".strip()
        
        if not text:
            return None
        
        logger.info(f"[Persona] Generating embedding for video {video.id}")
        embeddings = get_embeddings_batch_sync([text])
        
        if not embeddings or len(embeddings) == 0:
            return None
        
        embedding = embeddings[0]
        
        # DB에 저장 (videos_static)
        if video_static:
            video_static.embedding = embedding
        else:
            video_static = VideoStatic(
                video_id=video.id,
                embedding=embedding
            )
            db.add(video_static)
        
        db.commit()
        return embedding
        
    except Exception as e:
        logger.error(f"[Persona] Error getting video embedding: {e}", exc_info=True)
        db.rollback()
        return None


def calculate_cosine_similarity(
    vec1: List[float],
    vec2: List[float]
) -> float:
    """
    두 벡터 간 코사인 유사도 계산
    
    Args:
        vec1: 첫 번째 벡터
        vec2: 두 번째 벡터
        
    Returns:
        코사인 유사도 (0.0 ~ 1.0)
    """
    try:
        v1 = np.array(vec1)
        v2 = np.array(vec2)
        
        # 정규화
        norm1 = np.linalg.norm(v1)
        norm2 = np.linalg.norm(v2)
        
        if norm1 == 0 or norm2 == 0:
            return 0.0
        
        # 코사인 유사도
        similarity = np.dot(v1, v2) / (norm1 * norm2)
        
        # -1 ~ 1 범위를 0 ~ 1 범위로 변환 (선택사항)
        # similarity = (similarity + 1) / 2
        
        return float(similarity)
    except Exception as e:
        logger.error(f"[Persona] Error calculating similarity: {e}", exc_info=True)
        return 0.0

