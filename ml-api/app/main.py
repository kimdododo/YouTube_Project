from typing import Any, Dict, List
from fastapi import FastAPI
from pydantic import BaseModel
import numpy as np
import onnxruntime as ort
import os
import json
from typing import Optional, Dict

# 토크나이저 로드를 위한 import (선택적)
try:
    from transformers import AutoTokenizer
    _has_transformers = True
except ImportError:
    _has_transformers = False
    print("⚠️ transformers not installed, ONNX inference will use fallback")


class EmbedIn(BaseModel):
    text: str


class EmbedBatchIn(BaseModel):
    texts: List[str]


class EmbedOut(BaseModel):
    embedding: List[float]
    dim: int


class SentimentIn(BaseModel):
    text: str


class SentimentOut(BaseModel):
    score: float


class RerankCandidate(BaseModel):
    id: str
    text: str


class RerankIn(BaseModel):
    query: str
    candidates: List[RerankCandidate]


class RerankOutItem(BaseModel):
    id: str
    score: float


app = FastAPI(title="ML API", version="0.1.0")

_ort_sess: Optional[ort.InferenceSession] = None
_tokenizer: Optional[Any] = None
_dim: int = int(os.getenv("EMBEDDING_DIM", "768"))
_embeddings_map: Optional[Dict[str, List[float]]] = None
_word_map: Optional[Dict[str, List[float]]] = None


@app.on_event("startup")
def startup_load_model() -> None:
    global _ort_sess, _tokenizer
    global _embeddings_map, _word_map, _dim
    
    # ONNX 모델 로드 (optional, 없어도 됨)
    model_path = os.getenv("MODEL_PATH", "./model/finetuned_video_sts.onnx")
    if model_path and os.path.exists(model_path):
        try:
            providers = ["CPUExecutionProvider"]
            _ort_sess = ort.InferenceSession(model_path, providers=providers)
            print(f"✓ ONNX model loaded from {model_path}")
            
            # 토크나이저 로드 (ONNX 모델이 있으면 토크나이저도 필요)
            if _has_transformers:
                tokenizer_path = os.path.dirname(model_path)  # 모델과 같은 디렉토리
                try:
                    _tokenizer = AutoTokenizer.from_pretrained(tokenizer_path, trust_remote_code=True)
                    print(f"✓ Tokenizer loaded from {tokenizer_path}")
                except Exception as e:
                    print(f"⚠️ Tokenizer load failed: {e}")
                    _tokenizer = None
        except Exception as e:
            print(f"⚠️ ONNX model load failed: {e}")
            _ort_sess = None
    else:
        _ort_sess = None
        print(f"ℹ️ ONNX model not found at {model_path}, using JSON embeddings only")

    # JSON embeddings (문장 전체 매핑)
    emb_json = os.getenv("EMBEDDINGS_JSON", "./model/embeddings.json")
    if os.path.exists(emb_json):
        try:
            with open(emb_json, "r", encoding="utf-8") as f:
                _embeddings_map = json.load(f)
            # adjust dim if provided vectors indicate a size
            for _k, v in _embeddings_map.items():
                if isinstance(v, list) and len(v) > 0:
                    _dim = len(v)
                    break
            print(f"✓ Loaded {len(_embeddings_map)} embeddings from {emb_json}")
        except Exception as e:
            print(f"⚠️ Failed to load embeddings.json: {e}")
            _embeddings_map = None
    else:
        print(f"ℹ️ embeddings.json not found at {emb_json}")

    # 단어 임베딩 (토크나이저 방식)
    word_json = os.getenv("WORD_EMBED_JSON", "./model/tokenizer/word_embeddings.json")
    if os.path.exists(word_json):
        try:
            with open(word_json, "r", encoding="utf-8") as f:
                _word_map = json.load(f)
            # adjust dim from first
            for _k, v in _word_map.items():
                if isinstance(v, list) and len(v) > 0:
                    _dim = len(v)
                    break
            print(f"✓ Loaded {len(_word_map)} word embeddings from {word_json}")
        except Exception as e:
            print(f"⚠️ Failed to load word_embeddings.json: {e}")
            _word_map = None
    else:
        print(f"ℹ️ word_embeddings.json not found at {word_json}")
    
    print(f"📊 Embedding dimension: {_dim}")


@app.get("/ping")
def ping() -> Dict[str, str]:
    return {"status": "ok"}


def _simple_encode(texts: List[str]) -> np.ndarray:
    # Priority 1: ONNX model inference
    if _ort_sess is not None and _tokenizer is not None:
        try:
            # 토크나이저로 텍스트 인코딩
            encoded = _tokenizer(texts, return_tensors="np", padding=True, truncation=True, max_length=512)
            input_ids = encoded["input_ids"].astype(np.int64)
            attention_mask = encoded["attention_mask"].astype(np.int64)
            
            # ONNX 추론
            outputs = _ort_sess.run(
                None,
                {
                    "input_ids": input_ids,
                    "attention_mask": attention_mask
                }
            )
            
            # last_hidden_state에서 평균 pooling (간단한 방법)
            # outputs[0] = last_hidden_state [batch, seq_len, hidden_dim]
            # outputs[1] = pooler_output [batch, hidden_dim] (있으면 사용)
            if len(outputs) > 1 and outputs[1] is not None:
                # pooler_output 사용
                embeddings = outputs[1].astype(np.float32)
            else:
                # last_hidden_state에서 attention_mask로 평균 pooling
                last_hidden = outputs[0].astype(np.float32)  # [batch, seq, hidden]
                mask = attention_mask.astype(np.float32)[:, :, np.newaxis]  # [batch, seq, 1]
                masked_sum = (last_hidden * mask).sum(axis=1)  # [batch, hidden]
                mask_sum = mask.sum(axis=1)  # [batch, 1]
                embeddings = masked_sum / (mask_sum + 1e-9)  # [batch, hidden]
            
            # L2 정규화 (선택적, 일반적으로 cosine similarity를 위해)
            norms = np.linalg.norm(embeddings, axis=1, keepdims=True)
            embeddings = embeddings / (norms + 1e-9)
            
            return embeddings.astype(np.float32)
        except Exception as e:
            print(f"⚠️ ONNX 추론 실패: {e}")
            # fallback으로 계속 진행
    
    # Priority 2: exact match from embeddings.json
    if _embeddings_map is not None and len(texts) == 1:
        vec = _embeddings_map.get(texts[0])
        if isinstance(vec, list) and len(vec) > 0:
            return np.array([vec], dtype=np.float32)

    # Priority 3: average word vectors from tokenizer/word_embeddings.json
    if _word_map is not None:
        vecs = []
        for t in texts:
            tokens = t.split()
            token_vecs = [np.array(_word_map[w], dtype=np.float32) for w in tokens if isinstance(_word_map.get(w), list)]
            if token_vecs:
                v = np.mean(token_vecs, axis=0)
            else:
                v = np.zeros((_dim,), dtype=np.float32)
            vecs.append(v)
        return np.stack(vecs, axis=0)

    # Priority 4: deterministic pseudo-embedding
    rng = np.random.default_rng(abs(hash("|".join(texts))) % (2**32))
    return rng.normal(size=(len(texts), _dim)).astype(np.float32)


@app.post("/embed", response_model=EmbedOut)
def embed(in_obj: EmbedIn) -> EmbedOut:
    vec = _simple_encode([in_obj.text])[0]
    return EmbedOut(embedding=vec.tolist(), dim=_dim)


@app.post("/embed/batch", response_model=List[EmbedOut])
def embed_batch(in_obj: EmbedBatchIn) -> List[EmbedOut]:
    vecs = _simple_encode(in_obj.texts)
    return [EmbedOut(embedding=v.tolist(), dim=_dim) for v in vecs]


@app.post("/sentiment", response_model=SentimentOut)
def sentiment(in_obj: SentimentIn) -> SentimentOut:
    # dummy sentiment: length-based pseudo score in [0,1]
    score = min(1.0, max(0.0, len(in_obj.text) / 100.0))
    return SentimentOut(score=score)


@app.post("/rerank", response_model=List[RerankOutItem])
def rerank(in_obj: RerankIn) -> List[RerankOutItem]:
    q_vec = _simple_encode([in_obj.query])[0]
    c_texts = [c.text for c in in_obj.candidates]
    mat = _simple_encode(c_texts)
    # cosine similarity
    def cos(a: np.ndarray, b: np.ndarray) -> float:
        na = np.linalg.norm(a) + 1e-6
        nb = np.linalg.norm(b) + 1e-6
        return float(np.dot(a, b) / (na * nb))

    scored = [RerankOutItem(id=c.id, score=cos(q_vec, v)) for c, v in zip(in_obj.candidates, mat)]
    scored.sort(key=lambda x: x.score, reverse=True)
    return scored


