"""
한줄 요약 RAG 체인 정의
OpenAI ChatCompletion 사용
"""
from langchain.chains import LLMChain
from langchain_openai import ChatOpenAI
from langchain.prompts import PromptTemplate
import os


ONE_LINE_SUMMARY_PROMPT = """
당신은 여행 영상 요약 전문가입니다.

다음 CONTEXT는 특정 영상의 설명/댓글 일부입니다.
이 CONTEXT를 기반으로, 이 영상이 어떤 여행 내용을 담고 있는지
한국어로 '한 줄 요약'만 생성하세요.

조건:
- 반드시 한 문장
- 25자 이내
- 주관적 감정 표현 금지
- 이모지 금지

# CONTEXT
{context}

# 출력:
한 줄 요약:
"""


def create_summary_chain() -> LLMChain:
    """한줄 요약 RAG 체인 생성"""

    openai_api_key = os.getenv("OPENAI_API_KEY", "").strip()
    if not openai_api_key:
        raise ValueError("OPENAI_API_KEY 환경 변수가 설정되지 않았습니다.")

    llm_model = os.getenv("LLM_MODEL", "gpt-4o-mini").strip()

    llm = ChatOpenAI(
        model=llm_model,
        temperature=float(os.getenv("LLM_TEMPERATURE", "0.7")),
        max_tokens=int(os.getenv("LLM_MAX_TOKENS", "50")),
        api_key=openai_api_key  # strip 이미 적용됨
    )

    prompt = PromptTemplate(
        input_variables=["context"],
        template=ONE_LINE_SUMMARY_PROMPT
    )

    return LLMChain(llm=llm, prompt=prompt)


def generate_summary_from_context(context: str) -> str:
    """컨텍스트로부터 한줄 요약 생성"""
    chain = create_summary_chain()
    result = chain.run(context=context)

    summary = result.strip()

    # 25자 제한 강제
    if len(summary) > 25:
        summary = summary[:25].rstrip()

    return summary
