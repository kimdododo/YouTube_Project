"""
한줄 요약 RAG 체인 정의
OpenAI ChatCompletion 사용
"""
from langchain.chains import LLMChain
from langchain_openai import ChatOpenAI
from langchain.prompts import PromptTemplate
import os


ONE_LINE_SUMMARY_PROMPT = """
당신은 '여행 콘텐츠 분석 AI'입니다.
여행자들이 영상을 클릭하기 전에 핵심 내용을 단번에 파악할 수 있도록,
제공된 CONTEXT를 기반으로 여행 영상의 본질을 가장 간결하게 추출합니다.

다음 CONTEXT는 해당 영상의 설명 또는 댓글 일부입니다.
이 정보를 기반으로, 이 영상이 어떤 여행 경험을 다루는지
한국어로 '한 줄 요약'을 생성하세요.

요약 규칙:
- 반드시 한 문장
- 최소 30자 이상 최대 80자 이내
- 객관적 정보 중심, 주관적 감정 표현 금지
- 이모지 사용 금지
- 핵심 지점만 정밀하게 압축

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
