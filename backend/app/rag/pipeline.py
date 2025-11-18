"""
End-to-End RAG 파이프라인
한줄 요약 생성 전체 프로세스 통합
"""
from typing import Optional
import os
from sqlalchemy.orm import Session
from langchain.schema import Document
from app.models.video_summary import VideoSummary
from app.rag.loader import load_video_documents
from app.rag.splitter import split_documents
from app.rag.vectorstore import add_documents_to_vectorstore
from app.rag.retriever import get_retriever
from app.rag.summarizer import generate_summary_from_context
from datetime import datetime


async def generate_one_line_summary(db: Session, video_id: str) -> str:
    """
    한줄 요약 생성 (캐시 우선, 없으면 RAG로 생성)
    
    Args:
        db: 데이터베이스 세션
        video_id: 비디오 ID
    
    Returns:
        한줄 요약 텍스트
    """
    summary_type = "one_line_rag"
    
    # 1) 캐시 조회
    cached_summary = (
        db.query(VideoSummary)
        .filter(
            VideoSummary.video_id == video_id,
            VideoSummary.summary_type == summary_type
        )
        .first()
    )
    
    if cached_summary:
        print(f"[RAG] Using cached summary for video_id: {video_id}")
        return cached_summary.summary_text
    
    # 2) 캐시가 없으면 RAG로 생성
    print(f"[RAG] Generating new summary for video_id: {video_id}")
    
    # 2-1) DB에서 문서 로드
    documents = load_video_documents(db, video_id)
    if not documents:
        # 문서가 없으면 기본 메시지 반환
        default_summary = "여행 영상입니다."
        # 기본 메시지도 캐시에 저장
        _save_summary_to_cache(db, video_id, summary_type, default_summary)
        return default_summary
    
    # 2-2) 텍스트 분리
    split_docs = split_documents(documents)
    print(f"[RAG] Split {len(documents)} documents into {len(split_docs)} chunks")
    
    # 2-3) 벡터스토어에 임베딩 + 인덱싱
    add_documents_to_vectorstore(split_docs, video_id)
    
    # 2-4) Retriever로 context 검색
    from app.rag.retriever import retrieve_documents
    retrieved_docs = retrieve_documents(video_id, "여행 내용 요약", k=5)
    
    # 검색된 문서들을 컨텍스트로 결합
    context_parts = [doc.page_content for doc in retrieved_docs]
    context = "\n\n".join(context_parts)
    
    if not context.strip():
        # 컨텍스트가 없으면 기본 메시지
        default_summary = "여행 영상입니다."
        _save_summary_to_cache(db, video_id, summary_type, default_summary)
        return default_summary
    
    # 2-5) LLM으로 한줄 요약 생성
    summary = generate_summary_from_context(context)
    
    # 2-6) video_summaries에 저장 (UPSERT)
    _save_summary_to_cache(db, video_id, summary_type, summary)
    
    print(f"[RAG] Summary generated and cached: {summary}")
    return summary


def _save_summary_to_cache(
    db: Session,
    video_id: str,
    summary_type: str,
    summary_text: str
):
    """
    요약을 캐시 테이블에 저장 (UPSERT)
    
    Args:
        db: 데이터베이스 세션
        video_id: 비디오 ID
        summary_type: 요약 타입
        summary_text: 요약 텍스트
    """
    # 기존 요약 조회
    existing = (
        db.query(VideoSummary)
        .filter(
            VideoSummary.video_id == video_id,
            VideoSummary.summary_type == summary_type
        )
        .first()
    )
    
    if existing:
        # 업데이트
        existing.summary_text = summary_text
        existing.model_name = os.getenv("LLM_MODEL", "gpt-4o-mini")
        existing.rag_version = "rag_v1"
        existing.updated_at = datetime.now()
    else:
        # 새로 생성
        new_summary = VideoSummary(
            video_id=video_id,
            summary_type=summary_type,
            summary_text=summary_text,
            model_name=os.getenv("LLM_MODEL", "gpt-4o-mini"),
            rag_version="rag_v1"
        )
        db.add(new_summary)
    
    db.commit()
    print(f"[RAG] Summary saved to cache for video_id: {video_id}")

