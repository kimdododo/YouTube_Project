"""
FastAPI 메인 애플리케이션
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes import video, channel
from app.api.routes import recommend, auth, search
from app.core.errors import attach_error_handlers
from fastapi import APIRouter

# FastAPI 앱 생성
app = FastAPI(
    title="YouTube Data Pipeline API",
    description="YouTube 데이터 수집 파이프라인 백엔드 API",
    version="1.0.0"
)

# CORS 설정 (React 프론트엔드에서 호출 가능하도록)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 프로덕션에서는 특정 도메인으로 제한
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
app.include_router(api_v1)

# Backward-compat routes for existing frontend (/api/...)
app.include_router(video.router)
app.include_router(channel.router)
# 인증 라우터도 backward-compat 경로 추가 (/api/auth)
app.include_router(auth.router, prefix="/api/auth")


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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

