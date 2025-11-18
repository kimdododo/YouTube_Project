"""
Chroma 벡터스토어 초기화 및 인덱싱
"""
from typing import List, Optional
from langchain.schema import Document
from langchain_community.vectorstores import Chroma
from langchain_community.embeddings import HuggingFaceEmbeddings
from app.rag.embeddings import get_embedding_model
import os


# 벡터스토어 디렉토리
PERSIST_DIRECTORY = "./vectorstore"


def get_vectorstore(embedding_model: Optional[HuggingFaceEmbeddings] = None) -> Chroma:
    """
    Chroma 벡터스토어 인스턴스 가져오기 (기존 또는 새로 생성)
    
    Args:
        embedding_model: 임베딩 모델 (None이면 자동 로드)
    
    Returns:
        Chroma 벡터스토어 인스턴스
    """
    if embedding_model is None:
        embedding_model = get_embedding_model()
    
    # Chroma 벡터스토어 로드 또는 생성
    vectorstore = Chroma(
        persist_directory=PERSIST_DIRECTORY,
        embedding_function=embedding_model
    )
    
    return vectorstore


def add_documents_to_vectorstore(
    documents: List[Document],
    video_id: str,
    embedding_model: Optional[HuggingFaceEmbeddings] = None
) -> Chroma:
    """
    문서들을 벡터스토어에 추가
    
    Args:
        documents: 추가할 Document 리스트
        video_id: 비디오 ID (필터링용)
        embedding_model: 임베딩 모델
    
    Returns:
        업데이트된 Chroma 벡터스토어
    """
    if embedding_model is None:
        embedding_model = get_embedding_model()
    
    # 기존 벡터스토어 가져오기
    vectorstore = get_vectorstore(embedding_model)
    
    # 문서 추가
    if documents:
        print(f"[RAG] Adding {len(documents)} documents to vectorstore for video_id: {video_id}")
        vectorstore.add_documents(documents)
        vectorstore.persist()
        print(f"[RAG] Documents added and persisted successfully")
    
    return vectorstore

