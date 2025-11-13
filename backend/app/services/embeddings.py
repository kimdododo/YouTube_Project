"""
임베딩 서비스 모듈
sentence-transformers/all-MiniLM-L6-v2 모델을 사용한 텍스트 임베딩 생성 및 키워드 유사도 계산
"""
import json
import os
from typing import List, Dict, Optional
import numpy as np
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity


# 전역 변수: 모델 및 키워드 풀 임베딩 캐싱
_model: Optional[SentenceTransformer] = None
_keyword_pool: List[str] = []
_keyword_embeddings: Optional[np.ndarray] = None


def get_model() -> SentenceTransformer:
    """
    MiniLM 모델 로딩 (싱글톤 패턴)
    서버 시작 시 한 번만 로드하여 메모리에 캐싱
    
    Returns:
        SentenceTransformer: all-MiniLM-L6-v2 모델 인스턴스
    """
    global _model
    if _model is None:
        print("[Embeddings] Loading sentence-transformers/all-MiniLM-L6-v2 model...")
        _model = SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2')
        print("[Embeddings] Model loaded successfully")
    return _model


def load_keyword_pool(file_path: Optional[str] = None) -> List[str]:
    """
    keyword_pool.json 파일 로드
    
    Args:
        file_path: keyword_pool.json 파일 경로 (기본값: app/data/keyword_pool.json)
    
    Returns:
        List[str]: 키워드 리스트
    """
    global _keyword_pool
    if _keyword_pool:
        return _keyword_pool
    
    if file_path is None:
        # 기본 경로: backend/app/data/keyword_pool.json
        current_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        file_path = os.path.join(current_dir, "app", "data", "keyword_pool.json")
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            _keyword_pool = json.load(f)
        print(f"[Embeddings] Loaded {len(_keyword_pool)} keywords from {file_path}")
        return _keyword_pool
    except FileNotFoundError:
        print(f"[Embeddings] Warning: keyword_pool.json not found at {file_path}")
        # 기본 키워드 풀 반환
        _keyword_pool = [
            "자연", "바다", "힐링", "도시", "탐험", "액티비티", "문화", "체험",
            "럭셔리", "휴양", "맛집", "음식", "로맨틱", "감성", "사진", "명소"
        ]
        print(f"[Embeddings] Using default keyword pool with {len(_keyword_pool)} keywords")
        return _keyword_pool
    except json.JSONDecodeError as e:
        print(f"[Embeddings] Error parsing keyword_pool.json: {e}")
        raise


def get_keyword_embeddings() -> np.ndarray:
    """
    키워드 풀의 임베딩 벡터 생성 및 캐싱
    서버 시작 시 한 번만 계산하여 메모리에 저장
    
    Returns:
        np.ndarray: 키워드 임베딩 행렬 (shape: [n_keywords, embedding_dim])
    """
    global _keyword_embeddings
    if _keyword_embeddings is not None:
        return _keyword_embeddings
    
    # 키워드 풀 로드
    keywords = load_keyword_pool()
    
    # 모델 로드
    model = get_model()
    
    # 모든 키워드에 대한 임베딩 생성
    print(f"[Embeddings] Generating embeddings for {len(keywords)} keywords...")
    _keyword_embeddings = model.encode(keywords, convert_to_numpy=True, show_progress_bar=True)
    print(f"[Embeddings] Keyword embeddings cached (shape: {_keyword_embeddings.shape})")
    
    return _keyword_embeddings


def encode_text(text: str) -> np.ndarray:
    """
    텍스트를 임베딩 벡터로 변환
    
    Args:
        text: 임베딩할 텍스트
    
    Returns:
        np.ndarray: 임베딩 벡터 (1차원 배열)
    """
    model = get_model()
    embedding = model.encode(text, convert_to_numpy=True)
    return embedding


def compute_keyword_similarities(
    text: str,
    top_k: int = 7
) -> List[Dict[str, float]]:
    """
    텍스트와 키워드 풀 간의 코사인 유사도를 계산하여 상위 Top-K 키워드 반환
    
    Args:
        text: 분석할 텍스트 (title + description + comments)
        top_k: 반환할 상위 키워드 개수 (기본값: 7)
    
    Returns:
        List[Dict[str, float]]: [{"keyword": "힐링", "score": 0.91}, ...] 형식의 리스트
                                score 기준 내림차순 정렬
    """
    # 텍스트가 비어있으면 빈 리스트 반환
    if not text or not text.strip():
        return []
    
    # 텍스트 임베딩 생성
    text_embedding = encode_text(text)
    text_embedding = text_embedding.reshape(1, -1)  # (1, embedding_dim) 형태로 변환
    
    # 키워드 임베딩 가져오기
    keyword_embeddings = get_keyword_embeddings()
    
    # 코사인 유사도 계산
    similarities = cosine_similarity(text_embedding, keyword_embeddings)[0]  # (n_keywords,) 형태
    
    # 키워드 풀 가져오기
    keywords = load_keyword_pool()
    
    # (키워드, 유사도) 튜플 리스트 생성
    keyword_scores = [
        {"keyword": keyword, "score": float(similarity)}
        for keyword, similarity in zip(keywords, similarities)
    ]
    
    # score 기준 내림차순 정렬
    keyword_scores.sort(key=lambda x: x["score"], reverse=True)
    
    # 상위 top_k개만 반환
    return keyword_scores[:top_k]


def initialize_embeddings():
    """
    서버 시작 시 임베딩 모델 및 키워드 풀 임베딩 초기화
    이 함수를 main.py의 startup 이벤트에서 호출
    """
    print("[Embeddings] Initializing embedding service...")
    try:
        # 모델 로드
        get_model()
        
        # 키워드 풀 로드
        load_keyword_pool()
        
        # 키워드 임베딩 사전 계산
        get_keyword_embeddings()
        
        print("[Embeddings] Embedding service initialized successfully")
    except Exception as e:
        print(f"[Embeddings] Error initializing embedding service: {e}")
        raise

