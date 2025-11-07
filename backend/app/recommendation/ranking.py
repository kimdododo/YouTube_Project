"""
랭킹 점수 계산 모듈

공식:
  sentiment_score = 0.6 * pos_ratio + 0.4 * avg_score
  topic_score     = 1.0 if video_topic == target_topic else topic_score * 0.7
  popularity      = log(views + 1)
  final_score     = 0.5 * sentiment_score + 0.3 * topic_score + 0.2 * popularity

향후 확장:
  - user_features 테이블에 사용자 주제 친화도(user_affinity) 등이 생기면
    final_score += 0.1 * user_affinity 형태로 간단히 가산/가중치 추가 가능
"""
from __future__ import annotations

import math
from typing import Optional


def compute_sentiment_score(pos_ratio: Optional[float], avg_score: Optional[float]) -> float:
    pr = float(pos_ratio or 0.0)
    av = float(avg_score or 0.0)
    return 0.6 * pr + 0.4 * av


def adjust_topic_score(base_topic_score: Optional[float], video_topic_id: Optional[int], target_topic_id: Optional[int]) -> float:
    base = float(base_topic_score or 0.0)
    if target_topic_id is None or video_topic_id is None:
        return base
    return 1.0 if video_topic_id == target_topic_id else base * 0.7


def compute_popularity(views: Optional[int]) -> float:
    v = int(views or 0)
    return math.log(v + 1)


def compute_final_score(
    pos_ratio: Optional[float],
    avg_score: Optional[float],
    topic_score: Optional[float],
    video_topic_id: Optional[int],
    target_topic_id: Optional[int],
    views: Optional[int],
    user_affinity: Optional[float] = None,
) -> float:
    sentiment = compute_sentiment_score(pos_ratio, avg_score)
    topic = adjust_topic_score(topic_score, video_topic_id, target_topic_id)
    popularity = compute_popularity(views)
    base = 0.5 * sentiment + 0.3 * topic + 0.2 * popularity
    # 향후 user_features 연동 시 간단 가중치 추가
    if user_affinity is not None:
        base += 0.1 * float(user_affinity)
    return float(base)


