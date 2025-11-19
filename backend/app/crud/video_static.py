"""
Video Static CRUD
"""
from sqlalchemy.orm import Session
from app.models.video_static import VideoStatic
from typing import Optional, Dict, Any


def get_video_static(db: Session, video_id: str) -> Optional[VideoStatic]:
    """비디오 정적 정보 조회"""
    return db.query(VideoStatic).filter(VideoStatic.video_id == video_id).first()


def create_or_update_video_static(
    db: Session,
    video_id: str,
    summary: Optional[str] = None,
    sentiment: Optional[float] = None,
    topics: Optional[Dict[str, float]] = None,
    embedding: Optional[list] = None
) -> VideoStatic:
    """비디오 정적 정보 생성 또는 업데이트"""
    static = get_video_static(db, video_id)
    
    if static:
        if summary is not None:
            static.summary = summary
        if sentiment is not None:
            static.sentiment = sentiment
        if topics is not None:
            static.topics = topics
        if embedding is not None:
            static.embedding = embedding
    else:
        static = VideoStatic(
            video_id=video_id,
            summary=summary,
            sentiment=sentiment,
            topics=topics,
            embedding=embedding
        )
        db.add(static)
    
    db.commit()
    db.refresh(static)
    return static

