"""
RAG 문서 로더
DB에서 travel_videos와 travel_comments 데이터를 로드하여 Document 객체로 변환
"""
from typing import List
from langchain.schema import Document
from sqlalchemy.orm import Session
from sqlalchemy import desc
from app.models.video import Video
from app.models.comment import Comment
import json


def load_video_documents(db: Session, video_id: str) -> List[Document]:
    """
    특정 video_id에 대한 문서들을 로드
    
    Args:
        db: 데이터베이스 세션
        video_id: 비디오 ID
    
    Returns:
        Document 리스트 (metadata 포함)
    """
    documents = []
    
    # 1. travel_videos에서 메타데이터 로드
    video = db.query(Video).filter(Video.id == video_id).first()
    if video:
        # title
        if video.title:
            documents.append(Document(
                page_content=video.title,
                metadata={
                    "video_id": video_id,
                    "source": "meta",
                    "chunk_index": 0,
                    "field": "title"
                }
            ))
        
        # description
        if video.description:
            documents.append(Document(
                page_content=video.description,
                metadata={
                    "video_id": video_id,
                    "source": "meta",
                    "chunk_index": 1,
                    "field": "description"
                }
            ))
        
        # keyword
        if video.keyword:
            documents.append(Document(
                page_content=video.keyword,
                metadata={
                    "video_id": video_id,
                    "source": "meta",
                    "chunk_index": 2,
                    "field": "keyword"
                }
            ))
        
        # region
        if video.region:
            documents.append(Document(
                page_content=video.region,
                metadata={
                    "video_id": video_id,
                    "source": "meta",
                    "chunk_index": 3,
                    "field": "region"
                }
            ))
        
        # tags (JSON을 문자열로 합침)
        if video.tags:
            try:
                if isinstance(video.tags, str):
                    tags_list = json.loads(video.tags)
                else:
                    tags_list = video.tags
                
                if isinstance(tags_list, list) and len(tags_list) > 0:
                    tags_text = ", ".join([str(tag) for tag in tags_list])
                    documents.append(Document(
                        page_content=tags_text,
                        metadata={
                            "video_id": video_id,
                            "source": "meta",
                            "chunk_index": 4,
                            "field": "tags"
                        }
                    ))
            except (json.JSONDecodeError, TypeError):
                pass
    
    # 2. travel_comments에서 상위 N개 댓글 로드 (like_count 기준)
    comments = (
        db.query(Comment)
        .filter(Comment.video_id == video_id)
        .order_by(desc(Comment.like_count))
        .limit(30)
        .all()
    )
    
    chunk_index = len(documents)  # 메타데이터 chunk_index 이어서
    for idx, comment in enumerate(comments):
        if comment.text:
            documents.append(Document(
                page_content=comment.text,
                metadata={
                    "video_id": video_id,
                    "source": "comment",
                    "chunk_index": chunk_index + idx,
                    "comment_id": comment.id,
                    "like_count": comment.like_count or 0
                }
            ))
    
    return documents

