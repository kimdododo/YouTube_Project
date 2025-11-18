"""
한줄 요약 RAG 체인 정의
OpenAI ChatCompletion 사용
"""
from langchain.chains import LLMChain
from langchain_openai import ChatOpenAI
from langchain.prompts import PromptTemplate
import os


# 한줄 요약 프롬프트 템플릿
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
    """
    한줄 요약 RAG 체인 생성
    
    Returns:
        LLMChain 인스턴스
    """
    # OpenAI API 키 확인
    openai_api_key = os.getenv("OPENAI_API_KEY")
    if not openai_api_key:
        raise ValueError("OPENAI_API_KEY 환경 변수가 설정되지 않았습니다.")
    
    # ChatOpenAI 모델 사용 (gpt-4o-mini 추천)
    llm = ChatOpenAI(
        model=os.getenv("LLM_MODEL", "gpt-4o-mini"),
        temperature=float(os.getenv("LLM_TEMPERATURE", "0.7")),
        max_tokens=int(os.getenv("LLM_MAX_TOKENS", "50")),  # 25자 이내이므로 50 토큰으로 충분
        api_key=openai_api_key
    )
    
    # 프롬프트 템플릿 생성
    prompt = PromptTemplate(
        input_variables=["context"],
        template=ONE_LINE_SUMMARY_PROMPT
    )
    
    # LLMChain 생성
    chain = LLMChain(llm=llm, prompt=prompt)
    
    return chain


def generate_summary_from_context(context: str) -> str:
    """
    컨텍스트로부터 한줄 요약 생성
    
    Args:
        context: 검색된 문서들의 컨텍스트
    
    Returns:
        한줄 요약 텍스트
    """
    chain = create_summary_chain()
    result = chain.run(context=context)
    
    # 결과 정제 (불필요한 공백 제거)
    summary = result.strip()
    
    # 25자 초과 시 자르기
    if len(summary) > 25:
        summary = summary[:25].rstrip()
    
    return summary

