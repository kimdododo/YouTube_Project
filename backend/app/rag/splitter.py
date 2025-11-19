"""
텍스트 Chunk 분리기
LangChain의 RecursiveCharacterTextSplitter 사용
"""
from typing import List
from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter


def split_documents(documents: List[Document]) -> List[Document]:
    """
    Document 리스트를 chunk로 분리
    
    Args:
        documents: 원본 Document 리스트
    
    Returns:
        분리된 Document 리스트
    """
    # RecursiveCharacterTextSplitter 설정
    # 작은 chunk 크기로 설정 (한줄 요약이므로)
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=500,  # 작은 chunk 크기
        chunk_overlap=50,  # 50자 overlap
        length_function=len,
        separators=["\n\n", "\n", ". ", " ", ""]  # 분리 우선순위
    )
    
    # 각 문서를 분리
    split_docs = []
    for doc in documents:
        # metadata는 유지하면서 page_content만 분리
        chunks = text_splitter.split_text(doc.page_content)
        
        for idx, chunk in enumerate(chunks):
            # 원본 metadata 복사하고 chunk_index 업데이트
            metadata = doc.metadata.copy()
            metadata["chunk_index"] = metadata.get("chunk_index", 0) * 1000 + idx  # 중첩 인덱싱
            
            split_docs.append(Document(
                page_content=chunk,
                metadata=metadata
            ))
    
    return split_docs

