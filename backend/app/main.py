"""
FastAPI 메인 애플리케이션
"""
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes import video, channel
from app.api.routes import recommend, auth, search, summary
from app.api.routes import redis_test, personalized, videos_static
from app.api.routes import personalized_recommendations
from app.core.errors import attach_error_handlers
from app.core.database import get_db
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import Optional
from sqlalchemy import text

# FastAPI 앱 생성
app = FastAPI(
    title="YouTube Data Pipeline API",
    description="YouTube 데이터 수집 파이프라인 백엔드 API",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json"
)


@app.on_event("startup")
async def startup_event():
    """
    서버 시작 시 실행되는 초기화 함수
    임베딩 모델은 첫 요청 시 lazy loading으로 처리하여 서버 시작 시간 단축
    """
    print("[Startup] FastAPI application starting...")
    print("[Startup] Embedding service will be initialized on first request (lazy loading)")
    print("[Startup] FastAPI application ready")

# CORS 설정 (React 프론트엔드에서 호출 가능하도록)
import os
FRONTEND_URL = os.getenv("FRONTEND_URL", "*")
cors_origins = [FRONTEND_URL] if FRONTEND_URL != "*" else ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,  # 프로덕션에서는 특정 도메인으로 제한
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 라우터 등록
# error handlers
attach_error_handlers(app)

# versioned API router
api_v1 = APIRouter(prefix="/api/v1")
api_v1.include_router(video.router)
api_v1.include_router(channel.router)
api_v1.include_router(recommend.router)
api_v1.include_router(auth.router, prefix="/auth")  # /api/v1/auth
api_v1.include_router(search.router)
api_v1.include_router(summary.router)  # /api/v1/videos/{id}/summary/one-line
app.include_router(api_v1)

# Backward-compat routes for existing frontend (/api/...)
app.include_router(video.router)
app.include_router(channel.router)
app.include_router(summary.router)  # /api/videos/{id}/summary/one-line
# 인증 라우터도 backward-compat 경로 추가 (/api/auth)
app.include_router(auth.router, prefix="/api/auth")

# Redis 테스트 라우터
app.include_router(redis_test.router)

# 개인화 및 정적 정보 라우터
app.include_router(personalized.router)  # /personalized/{user_id}/{video_id}
app.include_router(videos_static.router)  # /videos/{video_id}/static
app.include_router(personalized_recommendations.router)  # /api/recommendations/personalized


@app.get("/")
def root():
    """루트 엔드포인트"""
    return {
        "message": "YouTube Data Pipeline API",
        "version": "1.0.0",
        "status": "running"
    }


@app.get("/ping")
def ping():
    """헬스 체크 엔드포인트"""
    return {"status": "ok", "message": "pong"}


@app.get("/api/ping")
def api_ping():
    """프론트 프록시(/api)용 핑"""
    return {"status": "ok", "message": "pong"}


@app.get("/api/comments")
async def get_comments(
    video_id: Optional[str] = Query(None, description="비디오 ID로 필터링"),
    limit: int = Query(10, ge=1, le=100, description="반환할 댓글 수"),
    offset: int = Query(0, ge=0, description="페이지네이션 오프셋"),
    db: Session = Depends(get_db)
):
    """댓글 목록 조회"""
    try:
        # SQLAlchemy를 사용하여 댓글 조회
        query = text("""
            SELECT * FROM travel_comments WHERE 1=1
        """)
        params = {}
        
        if video_id:
            query = text("""
                SELECT * FROM travel_comments 
                WHERE video_id = :video_id 
                ORDER BY published_at DESC 
                LIMIT :limit OFFSET :offset
            """)
            params = {"video_id": video_id, "limit": limit, "offset": offset}
        else:
            query = text("""
                SELECT * FROM travel_comments 
                ORDER BY published_at DESC 
                LIMIT :limit OFFSET :offset
            """)
            params = {"limit": limit, "offset": offset}
        
        result = db.execute(query, params)
        comments = result.fetchall()
        
        # 딕셔너리로 변환
        comments_list = []
        for row in comments:
            comment_dict = {}
            for key, value in row._mapping.items():
                comment_dict[key] = value
            comments_list.append(comment_dict)
        
        # 전체 개수 조회
        if video_id:
            count_query = text("""
                SELECT COUNT(*) as total FROM travel_comments 
                WHERE video_id = :video_id
            """)
            count_result = db.execute(count_query, {"video_id": video_id})
        else:
            count_query = text("SELECT COUNT(*) as total FROM travel_comments")
            count_result = db.execute(count_query)
        
        total = count_result.fetchone()[0]
        
        return {
            "comments": comments_list,
            "total": total,
            "limit": limit,
            "offset": offset
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"데이터베이스 조회 실패: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    import os
    # Cloud Run은 PORT 환경 변수를 제공하므로 이를 사용 (기본값 8080)
    port = int(os.getenv("PORT", "8080"))
    uvicorn.run(app, host="0.0.0.0", port=port)

