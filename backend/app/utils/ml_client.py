"""
ML API 클라이언트 유틸리티
web-api와 동일한 방식으로 ml-api를 호출
"""
from typing import Any, Dict, List, Optional
import httpx
import os


ML_API_BASE_URL = os.getenv("ML_API_BASE_URL", "http://ml-api:8100")


async def call_ml_api(path: str, payload: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """
    ML API를 호출하는 비동기 함수
    
    Args:
        path: API 경로 (예: "/embed", "/rerank")
        payload: 요청 페이로드
        
    Returns:
        API 응답 JSON 딕셔너리
    """
    url = f"{ML_API_BASE_URL.rstrip('/')}{path}"
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(url, json=payload)
            resp.raise_for_status()
            return resp.json()
    except httpx.TimeoutException:
        raise Exception(f"ML API 호출 시간 초과: {url}")
    except httpx.ConnectError:
        raise Exception(f"ML API 연결 실패: {url}. ml-api가 실행 중인지 확인하세요.")
    except httpx.HTTPStatusError as e:
        raise Exception(f"ML API HTTP 에러 {e.response.status_code}: {e.response.text[:200]}")


async def get_embedding(text: str) -> Optional[List[float]]:
    """
    텍스트를 임베딩으로 변환
    
    Args:
        text: 입력 텍스트
        
    Returns:
        768차원 임베딩 벡터
    """
    result = await call_ml_api("/embed", {"text": text})
    if result and "embedding" in result:
        return result["embedding"]
    return None


async def get_embeddings_batch(texts: List[str]) -> Optional[List[List[float]]]:
    """
    여러 텍스트를 배치로 임베딩 변환
    
    Args:
        texts: 입력 텍스트 리스트
        
    Returns:
        임베딩 벡터 리스트
    """
    result = await call_ml_api("/embed/batch", {"texts": texts})
    if result and isinstance(result, list):
        return [item.get("embedding") for item in result if "embedding" in item]
    return None


async def rerank_videos(query: str, candidates: List[Dict[str, str]]) -> Optional[List[Dict[str, Any]]]:
    """
    비디오 목록을 쿼리 기준으로 재랭킹
    
    Args:
        query: 검색 쿼리
        candidates: 재랭킹할 후보 리스트 [{"id": "...", "text": "..."}, ...]
        
    Returns:
        재랭킹된 결과 [{"id": "...", "score": 0.95}, ...]
    """
    result = await call_ml_api("/rerank", {
        "query": query,
        "candidates": candidates
    })
    if result and isinstance(result, list):
        return result
    return None

