from sqlalchemy.orm import Session
from sqlalchemy import and_
from app.models.user_travel_preference import UserTravelPreference
from app.models.user_travel_keyword import UserTravelKeyword
from typing import List


def save_user_preferences(db: Session, user_id: int, preference_ids: List[int]) -> List[UserTravelPreference]:
    """
    사용자 여행 취향 저장 (기존 취향 삭제 후 새로 저장)
    """
    try:
        # 기존 취향 삭제
        db.query(UserTravelPreference).filter(
            UserTravelPreference.user_id == user_id
        ).delete()
        
        # 새 취향 저장
        preferences = []
        for pref_id in preference_ids:
            # 유효성 검사 (1-11 범위)
            if not (1 <= pref_id <= 11):
                continue
            
            preference = UserTravelPreference(
                user_id=user_id,
                preference_id=pref_id
            )
            db.add(preference)
            preferences.append(preference)
        
        db.commit()
        
        # 저장된 객체 새로고침
        for pref in preferences:
            db.refresh(pref)
        
        return preferences
    except Exception as e:
        db.rollback()
        print(f"[ERROR] Failed to save user preferences: {e}")
        raise


def get_user_preferences(db: Session, user_id: int) -> List[int]:
    """
    사용자 여행 취향 조회
    Returns: preference_id 목록
    """
    try:
        preferences = db.query(UserTravelPreference).filter(
            UserTravelPreference.user_id == user_id
        ).order_by(UserTravelPreference.preference_id).all()
        
        return [pref.preference_id for pref in preferences]
    except Exception as e:
        # 테이블이 없을 수 있으므로 빈 리스트 반환
        print(f"[WARN] Failed to get user preferences (table may not exist): {e}")
        return []


def delete_user_preferences(db: Session, user_id: int) -> bool:
    """
    사용자 여행 취향 삭제
    """
    deleted = db.query(UserTravelPreference).filter(
        UserTravelPreference.user_id == user_id
    ).delete()
    
    db.commit()
    return deleted > 0


def save_user_keywords(db: Session, user_id: int, keywords: List[str]) -> List[UserTravelKeyword]:
    """
    사용자 여행 키워드 저장 (기존 키워드 삭제 후 새로 저장)
    """
    try:
        normalized_keywords = []
        for keyword in keywords:
            if not keyword:
                continue
            normalized_keywords.append(keyword.strip())

        # 기존 키워드 삭제
        db.query(UserTravelKeyword).filter(
            UserTravelKeyword.user_id == user_id
        ).delete()

        saved = []
        for key in normalized_keywords:
            if not key:
                continue
            keyword = UserTravelKeyword(
                user_id=user_id,
                keyword=key
            )
            db.add(keyword)
            saved.append(keyword)

        db.commit()

        for kw in saved:
            db.refresh(kw)

        return saved
    except Exception as e:
        db.rollback()
        print(f"[ERROR] Failed to save user keywords: {e}")
        raise


def get_user_keywords(db: Session, user_id: int) -> List[str]:
    """
    사용자 여행 키워드 조회
    """
    try:
        keywords = db.query(UserTravelKeyword).filter(
            UserTravelKeyword.user_id == user_id
        ).order_by(UserTravelKeyword.keyword).all()
        return [kw.keyword for kw in keywords]
    except Exception as e:
        print(f"[WARN] Failed to get user keywords (table may not exist): {e}")
        return []


def delete_user_keywords(db: Session, user_id: int) -> bool:
    deleted = db.query(UserTravelKeyword).filter(
        UserTravelKeyword.user_id == user_id
    ).delete()
    db.commit()
    return deleted > 0

