"""
Model Server entrypoint.
FastAPI 앱으로 분리된 RAG/LLM 파이프라인을 노출한다.
"""
import os
import sys
from pathlib import Path

BACKEND_PATH = Path(__file__).resolve().parents[1] / "backend"
if str(BACKEND_PATH) not in sys.path:
    sys.path.insert(0, str(BACKEND_PATH))

from fastapi import Depends, FastAPI, HTTPException
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.rag.pipeline import generate_one_line_summary

app = FastAPI(
    title="Model Server",
    description="RAG 요약 등 모델 호출 전용 서비스",
    version="0.1.0",
)


class SummaryRequest(BaseModel):
    video_id: str


class SummaryResponse(BaseModel):
    video_id: str
    summary_type: str
    summary: str


@app.get("/health")
async def health(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
        return {"status": "ok"}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/summaries/one-line", response_model=SummaryResponse)
async def create_one_line_summary(
    payload: SummaryRequest,
    db: Session = Depends(get_db),
):
    try:
        summary = await generate_one_line_summary(db, payload.video_id)
        return SummaryResponse(
            video_id=payload.video_id,
            summary_type="one_line_rag",
            summary=summary,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "8200")))

