"""
Model server HTTP client.
백엔드에서 분리된 모델 서버(RAG 요약 등)를 호출하기 위한 클라이언트입니다.
"""
from typing import Any, Dict

import httpx

from app.core.config import MODEL_SERVER_URL

SUMMARY_ENDPOINT = "/summaries/one-line"


def _build_url(path: str) -> str:
    if not MODEL_SERVER_URL:
        raise ValueError("MODEL_SERVER_URL 환경 변수가 설정되지 않았습니다.")
    base = MODEL_SERVER_URL.rstrip("/")
    return f"{base}{path}"


async def request_one_line_summary(video_id: str) -> Dict[str, Any]:
    """
    모델 서버에 한줄 요약 생성을 요청한다.

    Returns:
        {"video_id": str, "summary_type": str, "summary": str}
    """
    url = _build_url(SUMMARY_ENDPOINT)
    payload = {"video_id": video_id}

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(url, json=payload)
        resp.raise_for_status()
        return resp.json()

