from typing import Any, Dict, List, Optional
import httpx
from app.core.settings import Settings


async def call_ml_api(settings: Settings, path: str, payload: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    if not settings.ML_API_BASE_URL:
        return None
    url = f"{settings.ML_API_BASE_URL.rstrip('/')}{path}"
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


