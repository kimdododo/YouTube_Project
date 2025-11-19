"""
RAG Retriever 구성
video_id 필터링을 적용한 검색기
"""
from typing import List
from langchain_core.documents import Document
from langchain_community.vectorstores import Chroma
from langchain_community.embeddings import HuggingFaceEmbeddings
from app.rag.vectorstore import get_vectorstore
from app.rag.embeddings import get_embedding_model


def get_retriever(video_id: str, k: int = 5):
    """
    video_id 필터링이 적용된 retriever 생성
    
    Args:
        video_id: 필터링할 비디오 ID
        k: 반환할 문서 개수
    
    Returns:
        Retriever 객체
    """
    embedding_model = get_embedding_model()
    vectorstore = get_vectorstore(embedding_model)
    
    # video_id 필터링 적용
    retriever = vectorstore.as_retriever(
        search_type="similarity",
        search_kwargs={
            "k": k,
            "filter": {"video_id": video_id}  # video_id 필터링
        }
    )
    
    return retriever


def retrieve_documents(video_id: str, query: str, k: int = 5) -> List[Document]:
    """
    video_id 필터링을 적용하여 문서 검색
    
    Args:
        video_id: 필터링할 비디오 ID
        query: 검색 쿼리
        k: 반환할 문서 개수
    
    Returns:
        검색된 Document 리스트
    """
    retriever = get_retriever(video_id, k)
    documents = retriever.get_relevant_documents(query)
    return documents

