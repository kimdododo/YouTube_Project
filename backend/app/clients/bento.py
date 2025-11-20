"""
BentoML service client utilities.

This module centralizes outbound HTTP calls so the rest of the codebase
doesn't need to worry about base URLs, timeouts, or payload formatting.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List

import httpx

from app.core.config import BENTO_BASE_URL

logger = logging.getLogger(__name__)

DEFAULT_TIMEOUT = httpx.Timeout(30.0, read=30.0)


def _get_base_url() -> str:
    if not BENTO_BASE_URL:
        raise ValueError("BENTO_BASE_URL is not configured")
    return BENTO_BASE_URL.rstrip("/")


async def analyze_video_detail_for_bento(
    video_id: str,
    title: str,
    description: str,
    comments: List[Dict[str, Any]],
    endpoint_path: str = "/v1/video-detail",
) -> Dict[str, Any]:
    """
    Call the BentoML video-detail analysis endpoint and return the parsed JSON payload.

    Args:
        video_id: Target video identifier.
        title: Video title text.
        description: Video description text.
        comments: Minimal comment payload list (comment_id, text, like_count).
        endpoint_path: Relative path of the Bento endpoint. Defaults to ``/v1/video-detail``.

    Returns:
        Dict[str, Any]: The BentoML response payload.
    """

    base_url = _get_base_url()
    url = f"{base_url}{endpoint_path}"
    payload = {
        "video_id": video_id,
        "title": title or "",
        "description": description or "",
        "comments": comments,
    }

    logger.debug("[BentoClient] POST %s payload_comment_count=%s", url, len(comments))

    async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT) as client:
        response = await client.post(url, json=payload)
        try:
            response.raise_for_status()
        except httpx.HTTPStatusError as exc:
            logger.error(
                "[BentoClient] Bento request failed: status=%s body=%s",
                exc.response.status_code,
                exc.response.text,
            )
            raise

    data = response.json()
    logger.debug("[BentoClient] Received keys: %s", list(data.keys()))
    return data


