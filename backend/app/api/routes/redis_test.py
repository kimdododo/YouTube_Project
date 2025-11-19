"""
Redis 연결 테스트 엔드포인트
"""
from fastapi import APIRouter, HTTPException
from app.core.redis_client import get_redis
import json
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/test/redis", tags=["test"])


@router.get("/ping")
def redis_ping():
    """Redis 연결 테스트"""
    try:
        redis_client = get_redis()
        result = redis_client.ping()
        return {
            "status": "success",
            "message": "Redis connection successful",
            "ping": result
        }
    except Exception as e:
        logger.error(f"[Redis Test] Connection failed: {e}")
        raise HTTPException(status_code=503, detail=f"Redis connection failed: {str(e)}")


@router.post("/set/{key}")
def redis_set(key: str, value: str):
    """Redis에 키-값 저장 테스트 (POST)"""
    try:
        redis_client = get_redis()
        redis_client.set(key, value, ex=3600)  # 1시간 TTL
        return {
            "status": "success",
            "message": f"Key '{key}' set successfully",
            "key": key,
            "value": value
        }
    except Exception as e:
        logger.error(f"[Redis Test] Set failed: {e}")
        raise HTTPException(status_code=500, detail=f"Redis set failed: {str(e)}")


@router.get("/set/{key}")
def redis_set_get(key: str, value: str):
    """Redis에 키-값 저장 테스트 (GET - 브라우저 테스트용)"""
    try:
        redis_client = get_redis()
        redis_client.set(key, value, ex=3600)  # 1시간 TTL
        return {
            "status": "success",
            "message": f"Key '{key}' set successfully",
            "key": key,
            "value": value
        }
    except Exception as e:
        logger.error(f"[Redis Test] Set failed: {e}")
        raise HTTPException(status_code=500, detail=f"Redis set failed: {str(e)}")


@router.get("/get/{key}")
def redis_get(key: str):
    """Redis에서 키-값 조회 테스트"""
    try:
        redis_client = get_redis()
        value = redis_client.get(key)
        if value is None:
            raise HTTPException(status_code=404, detail=f"Key '{key}' not found")
        
        # bytes를 문자열로 디코딩
        if isinstance(value, bytes):
            value = value.decode('utf-8')
        
        return {
            "status": "success",
            "key": key,
            "value": value
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[Redis Test] Get failed: {e}")
        raise HTTPException(status_code=500, detail=f"Redis get failed: {str(e)}")


@router.delete("/del/{key}")
def redis_delete(key: str):
    """Redis에서 키 삭제 테스트"""
    try:
        redis_client = get_redis()
        deleted = redis_client.delete(key)
        return {
            "status": "success",
            "message": f"Key '{key}' deleted" if deleted else f"Key '{key}' not found",
            "deleted": bool(deleted)
        }
    except Exception as e:
        logger.error(f"[Redis Test] Delete failed: {e}")
        raise HTTPException(status_code=500, detail=f"Redis delete failed: {str(e)}")

