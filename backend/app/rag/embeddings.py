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
    BGE-M3 임베딩 모델 로드 (싱글톤 패턴)
    
    Returns:
        HuggingFaceEmbeddings 인스턴스
    """
    global _embedding_model
    
    if _embedding_model is None:
        print("[RAG] Loading BGE-M3 embedding model...")
        _embedding_model = HuggingFaceEmbeddings(
            model_name="BAAI/bge-m3",
            model_kwargs={
                "device": "cpu"  # GPU가 있으면 "cuda"로 변경 가능
            },
            encode_kwargs={
                "normalize_embeddings": True  # 정규화
            }
        )
        print("[RAG] BGE-M3 embedding model loaded successfully")
    
    return _embedding_model

