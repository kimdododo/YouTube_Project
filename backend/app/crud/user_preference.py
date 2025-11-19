"""
User Preference CRUD
"""
from sqlalchemy.orm import Session
from app.models.user_preference import UserPreference
from app.models.user_travel_preference import UserTravelPreference
from app.models.user_travel_keyword import UserTravelKeyword
from typing import Optional, Dict, Any, List


# ===== user_preferences 테이블 (embedding, topics 저장용) =====

def get_user_preference(db: Session, user_id: int) -> Optional[UserPreference]:
    """사용자 취향 정보 조회 (embedding, topics)"""
    return db.query(UserPreference).filter(UserPreference.user_id == user_id).first()


def create_or_update_user_preference(
    db: Session,
    user_id: int,
    embedding: Optional[list] = None,
    topics: Optional[Dict[str, float]] = None,
    sentiment_weight: float = 0.3
) -> UserPreference:
    """사용자 취향 정보 생성 또는 업데이트 (embedding, topics)"""
    pref = get_user_preference(db, user_id)
    
    if pref:
        if embedding is not None:
            pref.embedding = embedding
        if topics is not None:
            pref.topics = topics
        pref.sentiment_weight = sentiment_weight
    else:
        pref = UserPreference(
            user_id=user_id,
            embedding=embedding,
            topics=topics,
            sentiment_weight=sentiment_weight
        )
        db.add(pref)
    
    db.commit()
    db.refresh(pref)
    return pref


# ===== user_travel_preferences 테이블 (기존 preference_ids 저장용) =====

def save_user_preferences(db: Session, user_id: int, preference_ids: List[int]):
    """사용자 여행 취향 저장 (preference_ids 리스트)"""
    # 기존 취향 삭제
    delete_user_preferences(db, user_id)
    
    # 새 취향 저장
    for pref_id in preference_ids:
        pref = UserTravelPreference(
            user_id=user_id,
            preference_id=pref_id
        )
        db.add(pref)
    
    db.commit()


def get_user_preferences(db: Session, user_id: int) -> List[int]:
    """사용자 여행 취향 조회 (preference_ids 리스트 반환)"""
    prefs = db.query(UserTravelPreference).filter(
        UserTravelPreference.user_id == user_id
    ).all()
    
    return [pref.preference_id for pref in prefs]


def delete_user_preferences(db: Session, user_id: int):
    """사용자 여행 취향 삭제"""
    db.query(UserTravelPreference).filter(
        UserTravelPreference.user_id == user_id
    ).delete()
    db.commit()


# ===== user_travel_keywords 테이블 =====

def save_user_keywords(db: Session, user_id: int, keywords: List[str]):
    """사용자 여행 키워드 저장"""
    # 기존 키워드 삭제
    delete_user_keywords(db, user_id)
    
    # 새 키워드 저장
    for keyword in keywords:
        kw = UserTravelKeyword(
            user_id=user_id,
            keyword=keyword
        )
        db.add(kw)
    
    db.commit()


def get_user_keywords(db: Session, user_id: int) -> List[str]:
    """사용자 여행 키워드 조회"""
    keywords = db.query(UserTravelKeyword).filter(
        UserTravelKeyword.user_id == user_id
    ).all()
    
    return [kw.keyword for kw in keywords]


def delete_user_keywords(db: Session, user_id: int):
    """사용자 여행 키워드 삭제"""
    db.query(UserTravelKeyword).filter(
        UserTravelKeyword.user_id == user_id
    ).delete()
    db.commit()
