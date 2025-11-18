"""
임베딩 모델 로더
HuggingFace BGE-M3 모델 사용
"""
from langchain_community.embeddings import HuggingFaceEmbeddings
import os


# 전역 임베딩 모델 (lazy loading)
_embedding_model = None


def get_embedding_model() -> HuggingFaceEmbeddings:
    """
    임베딩 모델 로드 (싱글톤 패턴)
    기본값: BAAI/bge-small-en (약 140MB)
    
    Returns:
        HuggingFaceEmbeddings 인스턴스
    """
    global _embedding_model
    
    if _embedding_model is None:
        model_name = os.getenv("EMBEDDING_MODEL_NAME", "BAAI/bge-small-en")
        device = os.getenv("EMBEDDING_MODEL_DEVICE", "cpu")
        
        print(f"[RAG] Loading embedding model: {model_name} (device={device})")
        _embedding_model = HuggingFaceEmbeddings(
            model_name=model_name,
            model_kwargs={
                "device": device  # GPU가 있으면 "cuda"로 변경 가능
            },
            encode_kwargs={
                "normalize_embeddings": True  # 정규화
            }
        )
        print("[RAG] Embedding model loaded successfully")
    
    return _embedding_model

