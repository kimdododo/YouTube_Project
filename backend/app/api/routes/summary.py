"""
Video Summary API 라우터
RAG 기반 한줄 요약 엔드포인트
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.core.database import get_db
from app.rag.pipeline import generate_one_line_summary

router = APIRouter(prefix="/api/videos", tags=["summary"])


class OneLineSummaryResponse(BaseModel):
    """한줄 요약 응답 모델"""
    video_id: str
    summary_type: str
    summary: str
    
    class Config:
        from_attributes = True


@router.get("/{video_id}/summary/one-line", response_model=OneLineSummaryResponse)
async def get_one_line_summary(
    video_id: str,
    db: Session = Depends(get_db)
):
    """
    RAG 기반 한줄 요약 조회/생성
    
    - 캐시에 있으면 즉시 반환
    - 없으면 RAG 파이프라인으로 생성 후 반환
    """
    try:
        # RAG 파이프라인 실행
        summary_text = await generate_one_line_summary(db, video_id)
        
        return OneLineSummaryResponse(
            video_id=video_id,
            summary_type="one_line_rag",
            summary=summary_text
        )
    except ValueError as e:
        # 환경 변수 누락 등
        raise HTTPException(status_code=500, detail=f"설정 오류: {str(e)}")
    except Exception as e:
        # 기타 오류
        import traceback
        print(f"[Summary API] Error: {str(e)}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"요약 생성 실패: {str(e)}")

