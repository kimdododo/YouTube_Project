from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
import httpx
from app.core.settings import get_settings, Settings
from app.utils.ml_client import call_ml_api

router = APIRouter(prefix="/ml-test", tags=["ml-test"])


class EmbedRequest(BaseModel):
    text: str


class EmbedResponse(BaseModel):
    embedding: list
    dim: int


@router.post("/embed")
async def test_embed(
    request: EmbedRequest,
    settings: Settings = Depends(get_settings),
):
    """ml-api의 /embed 엔드포인트를 호출하는 테스트"""
    try:
        if not settings.ML_API_BASE_URL:
            raise HTTPException(
                status_code=503,
                detail="ML_API_BASE_URL이 설정되지 않았습니다. 환경변수를 확인하세요."
            )
        
        result = await call_ml_api(settings, "/embed", {"text": request.text})
        if result is None:
            raise HTTPException(
                status_code=503,
                detail="ML API 응답이 None입니다. ml-api가 실행 중인지 확인하세요."
            )
        return EmbedResponse(**result)
    except HTTPException:
        raise
    except httpx.HTTPStatusError as e:
        raise HTTPException(
            status_code=e.response.status_code,
            detail=f"ML API HTTP 에러: {e.response.status_code} - {e.response.text[:200]}"
        )
    except httpx.RequestError as e:
        raise HTTPException(
            status_code=503,
            detail=f"ML API 연결 실패: {str(e)}. ml-api가 실행 중인지 확인하세요."
        )
    except Exception as e:
        import traceback
        raise HTTPException(
            status_code=500,
            detail=f"ML API 호출 실패: {type(e).__name__}: {str(e) or repr(e)}"
        )


@router.get("/ping")
async def test_ping(settings: Settings = Depends(get_settings)):
    """ml-api의 /ping 엔드포인트를 호출하는 테스트"""
    try:
        import httpx
        if not settings.ML_API_BASE_URL:
            raise HTTPException(status_code=503, detail="ML_API_BASE_URL이 설정되지 않았습니다")
        
        url = f"{settings.ML_API_BASE_URL.rstrip('/')}/ping"
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            return resp.json()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"ML API 호출 실패: {str(e)}")

