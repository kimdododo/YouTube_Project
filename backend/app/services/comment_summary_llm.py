"""
Generate three-line comment summaries using OpenAI (via LangChain).
"""
from __future__ import annotations

import logging
from typing import List

from langchain_openai import ChatOpenAI

from app.core.config import OPENAI_API_KEY, LLM_MODEL, LLM_TEMPERATURE, LLM_MAX_TOKENS

logger = logging.getLogger(__name__)

COMMENT_SUMMARY_PROMPT = """
당신은 사용자 생성 콘텐츠(UGC)를 정제하고 의미 단위로 분석하는 여행 데이터 전문가입니다.
아래 COMMENT_LIST는 특정 영상의 댓글 원문으로,
특수문자(이모지, 기호, 반복 문자, HTML 태그, 비표준 텍스트 등)가 포함될 수 있습니다.

**목표**
이 댓글들을 분석하여, 시청자 반응을 한국어로 '3줄 요약'하세요.

**정제 규칙**
- 불필요한 특수문자(이모지, 반복 문자열, HTML 태그 등)로 인해 의미가 왜곡되지 않도록 컨텍스트 중심으로 해석
- 원문이 불규칙해도 핵심 의도만 추출
- 원문의 감정 톤·관심 포인트·반복 의견을 중심으로 의미 축약

**출력 규칙**
- 반드시 3줄
- 각 줄은 하나의 핵심 인사이트 요약
- 과장·이모지·특수문자 사용 금지
- 여유 서비스 톤: 차분함 · 전문성 · 데이터 기반

# COMMENT_LIST (raw)
{comments}

# 출력 (Strict Format):
•
•
•
"""

_summary_llm: ChatOpenAI | None = None


def _get_summary_llm() -> ChatOpenAI:
    global _summary_llm
    if _summary_llm is None:
        if not OPENAI_API_KEY:
            raise ValueError("OPENAI_API_KEY 환경 변수가 설정되어 있지 않습니다.")
        _summary_llm = ChatOpenAI(
            model=LLM_MODEL,
            temperature=LLM_TEMPERATURE,
            max_tokens=LLM_MAX_TOKENS,
            api_key=OPENAI_API_KEY,
        )
    return _summary_llm


def _normalize_lines(text: str, max_lines: int) -> List[str]:
    lines = [
        line.lstrip("•").strip()
        for line in text.splitlines()
        if line.strip()
    ]
    lines = [line for line in lines if line]
    return lines[:max_lines]


def generate_comment_three_line_summary(
    comments: List[str],
    max_lines: int = 3,
) -> List[str]:
    cleaned = [c.strip() for c in comments if c and c.strip()]
    if not cleaned:
        return []

    fallback = cleaned[:max_lines]

    try:
        llm = _get_summary_llm()
    except Exception as exc:
        logger.warning("[CommentSummary] LLM 초기화 실패: %s", exc)
        return fallback

    prompt = COMMENT_SUMMARY_PROMPT.format(
        comments="\n".join(cleaned[:50])
    )

    try:
        response = llm.invoke(prompt)
        content = getattr(response, "content", "") if response else ""
        if not content:
            return fallback

        lines = _normalize_lines(content, max_lines)
        return lines or fallback
    except Exception as exc:
        logger.warning("[CommentSummary] 요약 생성 실패: %s", exc)
        return fallback

