"""
유사도 계산 유틸리티
"""
import numpy as np
from typing import List, Optional


def cosine_similarity(vec1: List[float], vec2: List[float]) -> float:
    """
    두 벡터의 코사인 유사도 계산
    
    Args:
        vec1: 첫 번째 벡터
        vec2: 두 번째 벡터
        
    Returns:
        코사인 유사도 (0~1)
    """
    if len(vec1) != len(vec2):
        return 0.0
    
    vec1_np = np.array(vec1)
    vec2_np = np.array(vec2)
    
    dot_product = np.dot(vec1_np, vec2_np)
    norm1 = np.linalg.norm(vec1_np)
    norm2 = np.linalg.norm(vec2_np)
    
    if norm1 == 0 or norm2 == 0:
        return 0.0
    
    return float(dot_product / (norm1 * norm2))


def compute_similarities(
    query_embedding: List[float],
    candidate_embeddings: List[List[float]]
) -> List[float]:
    """
    쿼리 임베딩과 여러 후보 임베딩들의 유사도 계산
    
    Args:
        query_embedding: 쿼리 임베딩 벡터
        candidate_embeddings: 후보 임베딩 벡터 리스트
        
    Returns:
        유사도 점수 리스트
    """
    return [cosine_similarity(query_embedding, cand) for cand in candidate_embeddings]

