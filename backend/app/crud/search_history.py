"""
검색 기록 CRUD 작업
"""
from sqlalchemy.orm import Session
from sqlalchemy import desc
from app.models.search_history import SearchHistory
from typing import List, Optional
from datetime import datetime


def create_search_history(db: Session, user_id: int, query: str) -> SearchHistory:
    """
    검색 기록 생성
    
    Args:
        db: 데이터베이스 세션
        user_id: 사용자 ID
        query: 검색어
    
    Returns:
        SearchHistory 객체
    """
    # 중복 제거: 같은 사용자가 같은 검색어를 최근에 검색한 경우 기존 기록 삭제
    existing = db.query(SearchHistory).filter(
        SearchHistory.user_id == user_id,
        SearchHistory.query == query
    ).first()
    
    if existing:
        # 기존 기록 삭제
        db.delete(existing)
        db.flush()
    
    # 새 기록 생성
    search_history = SearchHistory(
        user_id=user_id,
        query=query
    )
    db.add(search_history)
    db.commit()
    db.refresh(search_history)
    return search_history


def get_search_history(
    db: Session, 
    user_id: int, 
    limit: int = 20
) -> List[SearchHistory]:
    """
    사용자의 검색 기록 조회 (최신순)
    
    Args:
        db: 데이터베이스 세션
        user_id: 사용자 ID
        limit: 반환할 최대 개수
    
    Returns:
        SearchHistory 객체 리스트
    """
    return db.query(SearchHistory).filter(
        SearchHistory.user_id == user_id
    ).order_by(desc(SearchHistory.searched_at)).limit(limit).all()


def delete_search_history(db: Session, user_id: int, query: str) -> bool:
    """
    특정 검색 기록 삭제
    
    Args:
        db: 데이터베이스 세션
        user_id: 사용자 ID
        query: 삭제할 검색어
    
    Returns:
        삭제 성공 여부
    """
    search_history = db.query(SearchHistory).filter(
        SearchHistory.user_id == user_id,
        SearchHistory.query == query
    ).first()
    
    if search_history:
        db.delete(search_history)
        db.commit()
        return True
    return False


def clear_search_history(db: Session, user_id: int) -> int:
    """
    사용자의 모든 검색 기록 삭제
    
    Args:
        db: 데이터베이스 세션
        user_id: 사용자 ID
    
    Returns:
        삭제된 기록 수
    """
    deleted_count = db.query(SearchHistory).filter(
        SearchHistory.user_id == user_id
    ).delete()
    db.commit()
    return deleted_count

