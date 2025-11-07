"""
FastAPI 백엔드 진입점
YouTube 데이터 수집 파이프라인 API 서버

Airflow는 다른 컴퓨터에서 데이터를 수집하여 Cloud SQL에 저장하고,
이 백엔드는 Cloud SQL에서 데이터를 읽어 API로 제공합니다.
"""
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional, List
from database import get_db_connection, test_connection, DB_HOST, DB_PORT, DB_NAME

# FastAPI 앱 생성
app = FastAPI(
    title="YouTube Data Pipeline API",
    description="YouTube 데이터 수집 파이프라인 백엔드 API (Airflow는 다른 컴퓨터에서 실행 중)",
    version="1.0.0"
)

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 프로덕션에서는 특정 도메인으로 제한
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    """루트 엔드포인트"""
    return {
        "message": "YouTube Data Pipeline API",
        "version": "1.0.0",
        "status": "running",
        "note": "Airflow는 다른 컴퓨터에서 데이터를 수집 중입니다"
    }


@app.get("/health")
async def health_check():
    """헬스 체크 엔드포인트"""
    db_connected = test_connection()
    return {
        "status": "healthy" if db_connected else "degraded",
        "database": {
            "host": DB_HOST,
            "port": DB_PORT,
            "database": DB_NAME,
            "connected": db_connected
        }
    }


@app.get("/api/videos")
async def get_videos(
    limit: int = Query(10, ge=1, le=100, description="반환할 비디오 수"),
    offset: int = Query(0, ge=0, description="페이지네이션 오프셋"),
    channel_id: Optional[str] = Query(None, description="채널 ID로 필터링")
):
    """여행 비디오 목록 조회"""
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cursor:
                # 기본 쿼리
                query = "SELECT * FROM travel_videos WHERE 1=1"
                params = []
                
                # 채널 ID 필터링
                if channel_id:
                    query += " AND channel_id = %s"
                    params.append(channel_id)
                
                # 정렬 및 페이지네이션
                query += " ORDER BY published_at DESC LIMIT %s OFFSET %s"
                params.extend([limit, offset])
                
                cursor.execute(query, params)
                videos = cursor.fetchall()
                
                # 전체 개수 조회
                count_query = "SELECT COUNT(*) as total FROM travel_videos WHERE 1=1"
                count_params = []
                if channel_id:
                    count_query += " AND channel_id = %s"
                    count_params.append(channel_id)
                
                cursor.execute(count_query, count_params)
                total = cursor.fetchone()["total"]
                
                return {
                    "videos": videos,
                    "total": total,
                    "limit": limit,
                    "offset": offset
                }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"데이터베이스 조회 실패: {str(e)}")


@app.get("/api/videos/{video_id}")
async def get_video(video_id: str):
    """특정 비디오 상세 정보 조회"""
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute(
                    "SELECT * FROM travel_videos WHERE video_id = %s",
                    (video_id,)
                )
                video = cursor.fetchone()
                
                if not video:
                    raise HTTPException(status_code=404, detail="비디오를 찾을 수 없습니다")
                
                return video
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"데이터베이스 조회 실패: {str(e)}")


@app.get("/api/comments")
async def get_comments(
    video_id: Optional[str] = Query(None, description="비디오 ID로 필터링"),
    limit: int = Query(10, ge=1, le=100, description="반환할 댓글 수"),
    offset: int = Query(0, ge=0, description="페이지네이션 오프셋")
):
    """댓글 목록 조회"""
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cursor:
                query = "SELECT * FROM travel_comments WHERE 1=1"
                params = []
                
                if video_id:
                    query += " AND video_id = %s"
                    params.append(video_id)
                
                query += " ORDER BY published_at DESC LIMIT %s OFFSET %s"
                params.extend([limit, offset])
                
                cursor.execute(query, params)
                comments = cursor.fetchall()
                
                # 전체 개수 조회
                count_query = "SELECT COUNT(*) as total FROM travel_comments WHERE 1=1"
                count_params = []
                if video_id:
                    count_query += " AND video_id = %s"
                    count_params.append(video_id)
                
                cursor.execute(count_query, count_params)
                total = cursor.fetchone()["total"]
                
                return {
                    "comments": comments,
                    "total": total,
                    "limit": limit,
                    "offset": offset
                }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"데이터베이스 조회 실패: {str(e)}")


@app.get("/api/stats")
async def get_stats():
    """전체 통계 정보 조회"""
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cursor:
                stats = {}
                
                # 비디오 통계
                cursor.execute("SELECT COUNT(*) as total FROM travel_videos")
                stats["total_videos"] = cursor.fetchone()["total"]
                
                # 채널 통계
                cursor.execute("SELECT COUNT(DISTINCT channel_id) as total FROM travel_videos")
                stats["total_channels"] = cursor.fetchone()["total"]
                
                # 댓글 통계
                cursor.execute("SELECT COUNT(*) as total FROM travel_comments")
                stats["total_comments"] = cursor.fetchone()["total"]
                
                # 최근 업데이트 시간
                cursor.execute("SELECT MAX(published_at) as latest FROM travel_videos")
                latest_video = cursor.fetchone()["latest"]
                stats["latest_video_date"] = latest_video["latest"] if latest_video["latest"] else None
                
                return stats
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"데이터베이스 조회 실패: {str(e)}")


@app.get("/api/channels")
async def get_channels(
    limit: int = Query(10, ge=1, le=100, description="반환할 채널 수"),
    offset: int = Query(0, ge=0, description="페이지네이션 오프셋")
):
    """채널 목록 조회 (비디오가 있는 채널만)"""
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cursor:
                query = """
                    SELECT 
                        channel_id,
                        channel_title,
                        COUNT(*) as video_count,
                        MAX(published_at) as latest_video_date
                    FROM travel_videos
                    GROUP BY channel_id, channel_title
                    ORDER BY video_count DESC
                    LIMIT %s OFFSET %s
                """
                
                cursor.execute(query, (limit, offset))
                channels = cursor.fetchall()
                
                # 전체 채널 수
                cursor.execute("SELECT COUNT(DISTINCT channel_id) as total FROM travel_videos")
                total = cursor.fetchone()["total"]
                
                return {
                    "channels": channels,
                    "total": total,
                    "limit": limit,
                    "offset": offset
                }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"데이터베이스 조회 실패: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

