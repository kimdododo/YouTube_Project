"""
SimCSE 임베딩 서버 호출 유틸리티
"""
import logging
from typing import List, Optional
from app.core.config import EMBEDDING_SERVER_URL

logger = logging.getLogger(__name__)

# httpx는 비동기용, 동기 버전은 requests 사용
try:
    import requests
except ImportError:
    requests = None
    logger.warning("[Embeddings] requests library not available, install with: pip install requests")


def get_embeddings_batch_sync(texts: List[str], timeout: float = 30.0) -> Optional[List[List[float]]]:
    """
    동기 버전: SimCSE 임베딩 서버에서 여러 텍스트의 임베딩을 배치로 가져오기
    
    Args:
        texts: 임베딩할 텍스트 리스트
        timeout: 요청 타임아웃 (초)
        
    Returns:
        임베딩 벡터 리스트 (각 텍스트에 대한 벡터) 또는 None (실패 시)
    """
    if not EMBEDDING_SERVER_URL:
        logger.error("[Embeddings] EMBEDDING_SERVER_URL not configured")
        return None
    
    if not texts:
        logger.warning("[Embeddings] Empty texts list")
        return []
    
    if not requests:
        logger.error("[Embeddings] requests library not available")
        return None
    
    try:
        # SimCSE 서버의 /predict 엔드포인트 사용
        # 각 텍스트에 대해 순차적으로 호출 (동기 방식)
        embeddings = []
        
        for idx, text in enumerate(texts):
            try:
                response = requests.post(
                    f"{EMBEDDING_SERVER_URL}/predict",
                    json={"text": text},
                    headers={"Content-Type": "application/json"},
                    timeout=timeout
                )
                
                if response.status_code == 200:
                    data = response.json()
                    vector = data.get("vector")
                    if vector and isinstance(vector, list) and len(vector) > 0:
                        # vector는 [[0.123, ...]] 형태일 수 있으므로 첫 번째 요소 사용
                        if isinstance(vector[0], list):
                            embeddings.append(vector[0])
                        else:
                            embeddings.append(vector)
                    else:
                        logger.warning(f"[Embeddings] Invalid response format for text {idx}: {data}")
                        embeddings.append(None)
                else:
                    logger.error(f"[Embeddings] HTTP {response.status_code} for text {idx}: {response.text}")
                    embeddings.append(None)
            except Exception as e:
                logger.error(f"[Embeddings] Error getting embedding for text {idx}: {e}")
                embeddings.append(None)
        
        # None이 포함된 경우 필터링
        valid_embeddings = [emb for emb in embeddings if emb is not None]
        if len(valid_embeddings) != len(texts):
            logger.warning(f"[Embeddings] Only {len(valid_embeddings)}/{len(texts)} embeddings retrieved successfully")
        
        return valid_embeddings if valid_embeddings else None
        
    except Exception as e:
        logger.error(f"[Embeddings] Failed to get embeddings: {e}", exc_info=True)
        return None

