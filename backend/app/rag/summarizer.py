"""
한줄 요약 RAG 체인 정의
OpenAI ChatCompletion 사용
"""
import os
from langchain_openai import ChatOpenAI
from langchain_core.prompts import PromptTemplate


ONE_LINE_SUMMARY_PROMPT = """
당신은 '여유(YeoYou) 여행 콘텐츠 분석 AI'입니다.
다음 CONTEXT는 특정 여행 영상의 설명·댓글 일부입니다.
이 정보를 기반으로, 이 영상이 전달하는 여행 경험의 핵심 내용을
한국어로 한 문장으로 길게 요약하세요.

요약 스타일:
- 한 문장, 80자 이상
- 여유(YeoYou) 톤: 담백하고 안정적인 여행 가이드 느낌
- 지명, 활동, 특징, 분위기 등 구체 정보를 가능한 한 많이 포함
- 객관적 정보 중심, 주관적 감정 표현·이모지·과장 표현 금지
- 사용자가 이 한 줄만 보고도 영상의 핵심 내용을 그려볼 수 있게 서술
- 문장의 끝은 반드시 '~해요'로 마무리한다

# CONTEXT
{context}

# 출력:
한 줄 요약:
"""
prompt = PromptTemplate(
    input_variables=["context"],
    template=ONE_LINE_SUMMARY_PROMPT,
)


def _get_llm() -> ChatOpenAI:
    openai_api_key = os.getenv("OPENAI_API_KEY", "").strip()
    if not openai_api_key:
        raise ValueError("OPENAI_API_KEY 환경 변수가 설정되지 않았습니다.")

    llm_model = os.getenv("LLM_MODEL", "gpt-4o-mini").strip()
    temperature = float(os.getenv("LLM_TEMPERATURE", "0.7"))
    max_tokens = int(os.getenv("LLM_MAX_TOKENS", "200"))

    return ChatOpenAI(
        model=llm_model,
        temperature=temperature,
        max_tokens=max_tokens,
        api_key=openai_api_key,
    )


def generate_summary_from_context(context: str) -> str:
    """컨텍스트로부터 한줄 요약 생성"""
    llm = _get_llm()
    formatted_prompt = prompt.format(context=context)
    result = llm.invoke(formatted_prompt)
    summary = getattr(result, "content", str(result))
    return summary.strip()
