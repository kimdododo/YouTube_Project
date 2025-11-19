"""
개인화 점수 계산 서비스
user_pref와 video_static을 기반으로 개인화 점수 계산
"""
import numpy as np
from typing import Dict, Any


def cosine_similarity(a: list, b: list) -> float:
    """
    코사인 유사도 계산
    
    Args:
        a: 벡터 A
        b: 벡터 B
    
    Returns:
        코사인 유사도 (0.0-1.0)
    """
    try:
        if not a or not b:
            return 0.0
        
        # 리스트가 아닌 경우 변환 시도
        if not isinstance(a, list):
            a = list(a) if hasattr(a, '__iter__') else []
        if not isinstance(b, list):
            b = list(b) if hasattr(b, '__iter__') else []
        
        if not a or not b:
            return 0.0
        
        a_vec = np.array(a, dtype=float)
        b_vec = np.array(b, dtype=float)
        
        # 벡터 길이가 다르면 0 반환
        if len(a_vec) != len(b_vec):
            return 0.0
        
        # 벡터 길이 확인
        norm_a = np.linalg.norm(a_vec)
        norm_b = np.linalg.norm(b_vec)
        
        if norm_a == 0 or norm_b == 0:
            return 0.0
        
        # 코사인 유사도
        similarity = float(np.dot(a_vec, b_vec) / (norm_a * norm_b))
        
        # -1~1 범위를 0~1로 정규화
        return max(0.0, min(1.0, similarity))
    except Exception:
        return 0.0


def calculate_topic_score(user_topics: Dict[str, float], video_topics: Dict[str, float]) -> float:
    """
    토픽 점수 계산
    
    Args:
        user_topics: 사용자 토픽 점수 {topic: score}
        video_topics: 비디오 토픽 점수 {topic: weight}
    
    Returns:
        토픽 점수 (0.0-1.0)
    """
    try:
        if not user_topics or not video_topics:
            return 0.0
        
        # 딕셔너리가 아닌 경우 처리
        if not isinstance(user_topics, dict):
            user_topics = {}
        if not isinstance(video_topics, dict):
            video_topics = {}
        
        if not user_topics or not video_topics:
            return 0.0
        
        score = 0.0
        total_weight = 0.0
        
        for topic, weight in video_topics.items():
            try:
                weight_float = float(weight) if weight is not None else 0.0
                user_score = float(user_topics.get(topic, 0.0)) if user_topics.get(topic) is not None else 0.0
                score += user_score * weight_float
                total_weight += weight_float
            except (ValueError, TypeError):
                continue
        
        if total_weight == 0:
            return 0.0
        
        return float(score / total_weight)
    except Exception:
        return 0.0


def calculate_personalized_score(
    user_pref: Dict[str, Any],
    video_static: Dict[str, Any]
) -> Dict[str, float]:
    """
    개인화 점수 계산
    
    Args:
        user_pref: 사용자 취향 정보
        video_static: 비디오 정적 정보
    
    Returns:
        개인화 점수 딕셔너리
    """
    try:
        # 1. 임베딩 유사도 계산
        user_embedding = user_pref.get("embedding") or []
        video_embedding = video_static.get("embedding") or []
        similarity = cosine_similarity(user_embedding, video_embedding)
        
        # 2. 토픽 점수 계산
        user_topics = user_pref.get("topics") or {}
        video_topics = video_static.get("topics") or {}
        topic_score = calculate_topic_score(user_topics, video_topics)
        
        # 3. 감정 조정 계수
        try:
            video_sentiment = float(video_static.get("sentiment", 0.5))
        except (ValueError, TypeError):
            video_sentiment = 0.5
        
        try:
            sentiment_weight = float(user_pref.get("sentiment_weight", 0.3))
        except (ValueError, TypeError):
            sentiment_weight = 0.3
        
        sentiment_adjust = 1.0 + (video_sentiment - 0.5) * sentiment_weight
        # 조정값이 너무 극단적이지 않게 제한
        sentiment_adjust = max(0.8, min(1.2, sentiment_adjust))
        
        # 4. 최종 점수 계산 (가중 평균)
        # similarity 60%, topic_score 40%
        base_score = (similarity * 0.6) + (topic_score * 0.4)
        final_score = base_score * sentiment_adjust
        
        # 0.0-1.0 범위로 제한
        final_score = max(0.0, min(1.0, final_score))
        
        return {
            "similarity": round(similarity, 4),
            "topic_score": round(topic_score, 4),
            "sentiment_adjust": round(sentiment_adjust, 4),
            "final_score": round(final_score, 4)
        }
    except Exception as e:
        # 에러 발생 시 기본값 반환
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"[Scoring] Error calculating personalized score: {e}")
        return {
            "similarity": 0.0,
            "topic_score": 0.0,
            "sentiment_adjust": 1.0,
            "final_score": 0.0
        }

