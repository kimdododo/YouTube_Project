"""
댓글 감정 분석 및 요약 서비스 (LangChain 기반)
입력: 댓글 텍스트 리스트
출력: 긍정/부정 비율 및 키워드 리스트

사용 예시:
    comments = [
        "영상 너무 재밌어요",
        "편집이 깔끔해서 좋아요",
        "음성이 너무 작아서 잘 안 들려요"
    ]
    result = summarize_sentiment(comments)
    # 결과 예시:
    # {
    #     "positive_ratio": 0.67,
    #     "negative_ratio": 0.33,
    #     "positive_keywords": ["재미있는 영상", "편집 깔끔"],
    #     "negative_keywords": ["음성 작음"]
    # }
"""
import json
import re
from typing import List, Dict, Optional
from langchain_openai import ChatOpenAI
from langchain.prompts import ChatPromptTemplate
from langchain.chains import LLMChain
from app.core.config import OPENAI_API_KEY, LLM_MODEL, LLM_TEMPERATURE, LLM_MAX_TOKENS
import logging

logger = logging.getLogger(__name__)

# 공통 LLM 인스턴스 (싱글턴 패턴)
_llm_instance: Optional[ChatOpenAI] = None


def _get_llm() -> ChatOpenAI:
    """
    LLM 인스턴스 싱글턴 반환
    기존 AI 한줄 요약(rag/summarizer.py)과 동일한 설정 사용
    """
    global _llm_instance
    if _llm_instance is None:
        if not OPENAI_API_KEY:
            raise ValueError("OPENAI_API_KEY 환경 변수가 설정되지 않았습니다.")
        _llm_instance = ChatOpenAI(
            model=LLM_MODEL,
            temperature=LLM_TEMPERATURE,
            max_tokens=LLM_MAX_TOKENS,
            api_key=OPENAI_API_KEY,
        )
        logger.info(f"[SentimentSummary] LLM initialized: model={LLM_MODEL}, temperature={LLM_TEMPERATURE}, max_tokens={LLM_MAX_TOKENS}")
    return _llm_instance


# 감정 분류 프롬프트 (한국어 댓글 최적화)
SENTIMENT_PROMPT = ChatPromptTemplate.from_messages([
    ("system", """당신은 한국어 댓글의 감정을 분류하는 전문가입니다.
주어진 댓글을 읽고, 반드시 다음 중 하나만 답변하세요:
- positive
- negative

긴 설명 없이 라벨만 출력하세요."""),
    ("human", "댓글: {comment}\n감정: ")
])

# 키워드 추출 프롬프트 (한국어 최적화)
KEYWORD_PROMPT = ChatPromptTemplate.from_messages([
    ("system", """당신은 한국어 댓글에서 핵심 키워드를 추출하는 전문가입니다.
주어진 댓글들을 분석하여, 대표적인 키워드 3~5개를 추출하세요.

요구사항:
- 키워드는 짧은 명사나 구 형태로 작성 (예: "유익한 정보", "편집 깔끔", "음성 작음")
- 긴 문장이 아닌 핵심 키워드만 추출
- JSON 배열 형식으로만 출력: ["키워드1", "키워드2", "키워드3"]

출력 형식 예시:
["유익한 정보", "현지 분위기 최고", "편집 깔끔"]"""),
    ("human", "댓글 목록:\n{comments}\n\n키워드 (JSON 배열): ")
])


def classify_sentiment(comment: str) -> str:
    """
    단일 댓글의 감정을 분류 (positive / negative)
    
    Args:
        comment: 댓글 텍스트
        
    Returns:
        "positive" 또는 "negative"
        
    예시:
        classify_sentiment("영상 너무 재밌어요") -> "positive"
        classify_sentiment("음성이 너무 작아서 잘 안 들려요") -> "negative"
    """
    try:
        llm = _get_llm()
        chain = LLMChain(llm=llm, prompt=SENTIMENT_PROMPT)
        result = chain.run(comment=comment.strip())
        
        # 결과 정제 (공백 제거, 소문자 변환)
        label = result.strip().lower()
        if "positive" in label:
            return "positive"
        elif "negative" in label:
            return "negative"
        else:
            # 기본값: positive (애매한 경우)
            logger.warning(f"[SentimentSummary] Unexpected sentiment label: {result}, defaulting to positive")
            return "positive"
    except Exception as e:
        logger.error(f"[SentimentSummary] Error classifying sentiment: {e}")
        # 에러 시 기본값 반환
        return "positive"


def extract_keywords(comments: List[str], sentiment_type: str) -> List[str]:
    """
    특정 감정의 댓글들에서 키워드 추출
    
    Args:
        comments: 댓글 텍스트 리스트
        sentiment_type: "positive" 또는 "negative"
        
    Returns:
        키워드 리스트 (최대 5개)
        
    예시:
        extract_keywords(["영상 너무 재밌어요", "편집이 깔끔해서 좋아요"], "positive")
        -> ["재미있는 영상", "편집 깔끔"]
    """
    if not comments:
        return []
    
    try:
        # 댓글들을 하나의 텍스트로 결합 (줄바꿈으로 구분)
        comments_text = "\n".join([f"- {c.strip()}" for c in comments if c and c.strip()])
        
        llm = _get_llm()
        chain = LLMChain(llm=llm, prompt=KEYWORD_PROMPT)
        result = chain.run(comments=comments_text)
        
        # JSON 파싱 시도
        keywords = _parse_keywords(result)
        
        # 최대 5개로 제한
        return keywords[:5]
    except Exception as e:
        logger.error(f"[SentimentSummary] Error extracting keywords: {e}")
        return []


def _parse_keywords(result: str) -> List[str]:
    """
    LLM 출력에서 키워드 리스트 파싱
    JSON 배열 형식 또는 일반 텍스트에서 추출
    """
    if not result:
        return []
    
    # JSON 배열 형식 시도
    try:
        # JSON 배열 찾기 (예: ["키워드1", "키워드2"])
        json_match = re.search(r'\[.*?\]', result, re.DOTALL)
        if json_match:
            keywords = json.loads(json_match.group())
            if isinstance(keywords, list):
                return [str(k).strip() for k in keywords if k and str(k).strip()]
    except (json.JSONDecodeError, AttributeError):
        pass
    
    # JSON 파싱 실패 시, 줄바꿈이나 쉼표로 구분된 텍스트에서 추출
    lines = result.split('\n')
    keywords = []
    for line in lines:
        line = line.strip()
        # 불필요한 문자 제거
        line = re.sub(r'^[-•*]\s*', '', line)  # 리스트 마커 제거
        line = re.sub(r'["\']', '', line)  # 따옴표 제거
        if line and len(line) > 1:
            keywords.append(line)
    
    return keywords[:5]  # 최대 5개


def summarize_sentiment(comments: List[str]) -> Dict:
    """
    댓글 리스트를 분석하여 감정 요약 결과 반환
    
    Args:
        comments: 댓글 텍스트 리스트
        
    Returns:
        {
            "positive_ratio": 0.78,
            "negative_ratio": 0.22,
            "positive_keywords": ["유익한 정보", "현지 분위기 최고", ...],
            "negative_keywords": ["음성 작음", "영상 길이"]
        }
        
    예시:
        comments = [
            "영상 너무 재밌어요",
            "편집이 깔끔해서 좋아요",
            "음성이 너무 작아서 잘 안 들려요"
        ]
        
        결과 예시:
        {
            "positive_ratio": 0.67,
            "negative_ratio": 0.33,
            "positive_keywords": ["재미있는 영상", "편집 깔끔"],
            "negative_keywords": ["음성 작음"]
        }
    """
    if not comments:
        return {
            "positive_ratio": 0.0,
            "negative_ratio": 0.0,
            "positive_keywords": [],
            "negative_keywords": []
        }
    
    # 1. 각 댓글 감정 분류
    # TODO: 추후 batch 처리 또는 사전 학습된 감정 분류 모델(ONNX)로 대체 가능
    positive_comments = []
    negative_comments = []
    
    for comment in comments:
        if not comment or not comment.strip():
            continue
        
        sentiment = classify_sentiment(comment)
        if sentiment == "positive":
            positive_comments.append(comment)
        else:
            negative_comments.append(comment)
    
    # 2. 비율 계산
    total = len(positive_comments) + len(negative_comments)
    if total == 0:
        return {
            "positive_ratio": 0.0,
            "negative_ratio": 0.0,
            "positive_keywords": [],
            "negative_keywords": []
        }
    
    positive_ratio = len(positive_comments) / total
    negative_ratio = len(negative_comments) / total
    
    # 3. 키워드 추출
    positive_keywords = extract_keywords(positive_comments, "positive") if positive_comments else []
    negative_keywords = extract_keywords(negative_comments, "negative") if negative_comments else []
    
    return {
        "positive_ratio": round(positive_ratio, 2),
        "negative_ratio": round(negative_ratio, 2),
        "positive_keywords": positive_keywords,
        "negative_keywords": negative_keywords
    }

