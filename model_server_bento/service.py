"""
BentoML service that mirrors the legacy FastAPI SimCSE server.

Public endpoints (kept identical):
  - GET  /health          -> status payload
  - POST /predict         -> single sentence embedding
  - POST /predict/batch   -> batch sentence embeddings
  - POST /similarity      -> cosine similarity between two texts

Request/response schemas are aligned with the old kimdododo/simcse-serve image so
that the backend (FastAPI) and frontend clients do not need any changes.
"""
from __future__ import annotations

import logging
import os
import re
import traceback
from collections import Counter
from pathlib import Path
import threading
from typing import Any, Dict, List, Union

import bentoml
import numpy as np
import onnxruntime as ort
from pydantic import BaseModel, Field, validator
from transformers import AutoTokenizer, AutoConfig
from google.cloud import storage

# ---------------------------------------------------------------------------
# Logging setup
# ---------------------------------------------------------------------------
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
EMBED_MODEL_DIR = os.getenv("EMBED_MODEL_DIR", "models/simcse")
SENTIMENT_MODEL_DIR = os.getenv("SENTIMENT_MODEL_DIR", "models/sentiment")


def _compose_path(base: str, name: str) -> str:
    base = base.rstrip("/")
    if base.startswith("gs://"):
        return f"{base}/{name}".rstrip("/")
    return str(Path(base) / name)


DEFAULT_MODEL_PATH = os.getenv("MODEL_PATH") or _compose_path(EMBED_MODEL_DIR, "model.onnx")
DEFAULT_TOKENIZER_PATH = os.getenv("TOKENIZER_PATH") or _compose_path(EMBED_MODEL_DIR, "tokenizer")
DEFAULT_SENTIMENT_MODEL_PATH = os.getenv("SENTIMENT_MODEL_PATH") or _compose_path(
    SENTIMENT_MODEL_DIR, "model.onnx"
)
DEFAULT_SENTIMENT_TOKENIZER_PATH = os.getenv("SENTIMENT_TOKENIZER_PATH") or _compose_path(
    SENTIMENT_MODEL_DIR, "tokenizer"
)
MODEL_CACHE_ROOT = Path(os.getenv("MODEL_CACHE_ROOT", "/tmp/bento_model_cache"))
DEFAULT_SENTIMENT_LABELS = ["negative", "neutral", "positive"]
MAX_SEQ_LENGTH = int(os.getenv("MAX_SEQ_LENGTH", "256"))
NORMALIZE = os.getenv("NORMALIZE_EMBEDDINGS", "true").lower() in {"1", "true", "yes"}
ENABLE_STARTUP_WARMUP = os.getenv("SIMCSE_ENABLE_WARMUP", "true").lower() in {"1", "true", "yes"}
WARMUP_SAMPLE_TEXT = os.getenv("SIMCSE_WARMUP_TEXT", "warm up request")


_storage_client = None


def _get_storage_client() -> storage.Client:
    global _storage_client
    if _storage_client is None:
        _storage_client = storage.Client()
    return _storage_client


def _download_from_gcs(gcs_uri: str, cache_subdir: str, is_file: bool) -> Path:
    """
    Download from GCS with caching to reduce cold start overhead.
    Returns cached path if already downloaded, otherwise downloads and caches.
    """
    if not gcs_uri.startswith("gs://"):
        raise ValueError(f"Invalid GCS URI: {gcs_uri}")

    bucket_path = gcs_uri[5:]
    if "/" not in bucket_path:
        raise ValueError(f"GCS URI must include object path: {gcs_uri}")

    bucket_name, object_path = bucket_path.split("/", 1)
    cache_dir = MODEL_CACHE_ROOT / cache_subdir
    cache_dir.mkdir(parents=True, exist_ok=True)

    target_root = cache_dir / Path(object_path).name

    # 1) Check if already cached
    if is_file:
        if target_root.exists():
            logger.info(f"[GCS Cache] Reusing cached file: {target_root}")
            return target_root
    else:
        if target_root.exists() and any(target_root.rglob("*")):
            logger.info(f"[GCS Cache] Reusing cached directory: {target_root}")
            return target_root

    # 2) Download from GCS if not cached
    logger.info(f"[GCS Cache] Downloading from GCS: {gcs_uri}")
    client = _get_storage_client()
    bucket = client.bucket(bucket_name)

    if is_file:
        blob = bucket.blob(object_path)
        target_root.parent.mkdir(parents=True, exist_ok=True)
        blob.download_to_filename(target_root)
        return target_root

    prefix = object_path.rstrip("/") + "/"
    blobs = list(bucket.list_blobs(prefix=prefix))
    if not blobs:
        raise FileNotFoundError(f"No files found at {gcs_uri}")

    for blob in blobs:
        if blob.name.endswith("/"):
            continue
        relative = Path(blob.name[len(prefix) :])
        destination = target_root / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        blob.download_to_filename(destination)
    return target_root


def _ensure_local(path: Path, description: str, expect_dir: bool = False) -> Path:
    if expect_dir:
        if not path.exists() or not path.is_dir():
            raise FileNotFoundError(f"{description} not found at {path}")
        return path
    if not path.exists():
        raise FileNotFoundError(f"{description} not found at {path}")
    return path


def _resolve_path(raw: str, description: str, cache_subdir: str, is_file: bool) -> Path:
    raw = os.path.expandvars(raw)
    if raw.startswith("gs://"):
        return _download_from_gcs(raw, cache_subdir, is_file)
    path_obj = Path(raw)
    return _ensure_local(path_obj, description, expect_dir=not is_file)


MODEL_PATH = _resolve_path(DEFAULT_MODEL_PATH, "SimCSE ONNX model", "embed_model", True)
TOKENIZER_PATH = _resolve_path(
    DEFAULT_TOKENIZER_PATH, "SimCSE tokenizer directory", "embed_tokenizer", False
)
SENTIMENT_MODEL_PATH = _resolve_path(
    DEFAULT_SENTIMENT_MODEL_PATH, "Sentiment ONNX model", "sentiment_model", True
)
SENTIMENT_TOKENIZER_PATH = _resolve_path(
    DEFAULT_SENTIMENT_TOKENIZER_PATH,
    "Sentiment tokenizer directory",
    "sentiment_tokenizer",
    False,
)


# ---------------------------------------------------------------------------
# Model / tokenizer loading
# ---------------------------------------------------------------------------
class ModelBundle:
    def __init__(self, model_path: Path, tokenizer_path: Path):
        providers = ["CPUExecutionProvider"]
        self.session = ort.InferenceSession(str(model_path), providers=providers)
        self.tokenizer = AutoTokenizer.from_pretrained(
            tokenizer_path, use_fast=True, trust_remote_code=True
        )
        self.hidden_dim = self.session.get_outputs()[0].shape[-1]
        # Cache input names for dynamic input handling
        self.input_names = {inp.name for inp in self.session.get_inputs()}

    def encode(self, texts: List[str]) -> np.ndarray:
        encoded = self.tokenizer(
            texts,
            return_tensors="np",
            padding=True,
            truncation=True,
            max_length=MAX_SEQ_LENGTH,
        )
        # Build inputs dynamically based on model requirements
        inputs: Dict[str, np.ndarray] = {}
        if "input_ids" in self.input_names:
            inputs["input_ids"] = encoded["input_ids"].astype(np.int64)
        if "attention_mask" in self.input_names and "attention_mask" in encoded:
            inputs["attention_mask"] = encoded["attention_mask"].astype(np.int64)
        if "token_type_ids" in self.input_names and "token_type_ids" in encoded:
            inputs["token_type_ids"] = encoded["token_type_ids"].astype(np.int64)
        outputs = self.session.run(None, inputs)

        if len(outputs) > 1 and outputs[1] is not None:
            embeddings = outputs[1].astype(np.float32)
        else:
            last_hidden = outputs[0].astype(np.float32)
            mask = inputs["attention_mask"].astype(np.float32)[..., np.newaxis]
            masked_sum = (last_hidden * mask).sum(axis=1)
            mask_sum = mask.sum(axis=1)
            embeddings = masked_sum / (mask_sum + 1e-9)

        if NORMALIZE:
            norms = np.linalg.norm(embeddings, axis=1, keepdims=True)
            embeddings = embeddings / np.clip(norms, 1e-9, None)

        return embeddings


class ClassificationBundle:
    def __init__(self, model_path: Path, tokenizer_path: Path):
        providers = ["CPUExecutionProvider"]
        self.session = ort.InferenceSession(str(model_path), providers=providers)
        self.tokenizer = AutoTokenizer.from_pretrained(
            tokenizer_path, use_fast=True, trust_remote_code=True
        )
        # ONNX 입력 이름 미리 캐싱 (token_type_ids 필요 여부 확인용)
        self.input_names = {inp.name for inp in self.session.get_inputs()}

    def logits(self, texts: List[str]) -> np.ndarray:
        # 토크나이저 호출
        encoded = self.tokenizer(
            texts,
            return_tensors="np",
            padding=True,
            truncation=True,
            max_length=MAX_SEQ_LENGTH,
        )

        # 일부 토크나이저는 token_type_ids를 안 돌려줄 수 있으므로 직접 생성
        if "token_type_ids" not in encoded:
            encoded["token_type_ids"] = np.zeros_like(encoded["input_ids"])

        # ONNX에 맞게 int64로 변환
        inputs: Dict[str, np.ndarray] = {}

        if "input_ids" in self.input_names:
            inputs["input_ids"] = encoded["input_ids"].astype(np.int64)
        if "attention_mask" in self.input_names:
            inputs["attention_mask"] = encoded["attention_mask"].astype(np.int64)
        if "token_type_ids" in self.input_names:
            inputs["token_type_ids"] = encoded["token_type_ids"].astype(np.int64)

        # 실제 추론
        outputs = self.session.run(None, inputs)
        return outputs[0].astype(np.float32)


def softmax(logits: np.ndarray, axis: int = -1) -> np.ndarray:
    logits = logits - np.max(logits, axis=axis, keepdims=True)
    exps = np.exp(logits)
    return exps / np.sum(exps, axis=axis, keepdims=True)


def _label_sort_key(key: Any) -> Any:
    try:
        return int(key)
    except (ValueError, TypeError):
        return key


def _load_sentiment_labels() -> List[str]:
    """
    Attempt to derive sentiment label order from model config (id2label).
    Falls back to DEFAULT_SENTIMENT_LABELS when metadata is missing.
    """
    candidate_paths = []
    try:
        candidate_paths.append(Path(SENTIMENT_MODEL_PATH).parent)
    except Exception:
        pass
    candidate_paths.append(SENTIMENT_TOKENIZER_PATH)
    # also consider parent of tokenizer directory (e.g., .../sentiment)
    try:
        candidate_paths.append(SENTIMENT_TOKENIZER_PATH.parent)
    except Exception:
        pass

    for path in candidate_paths:
        if not path or not Path(path).exists():
            continue
        try:
            config = AutoConfig.from_pretrained(
                str(path),
                local_files_only=True,
                trust_remote_code=True,
            )
            id2label = getattr(config, "id2label", None)
            if not id2label:
                continue
            sorted_items = sorted(id2label.items(), key=lambda kv: _label_sort_key(kv[0]))
            labels = [str(label).lower() for _, label in sorted_items]
            if labels:
                return labels
        except Exception:
            continue
    return DEFAULT_SENTIMENT_LABELS


SENTIMENT_LABELS = _load_sentiment_labels()
POS_LABEL_INDEX = next(
    (idx for idx, label in enumerate(SENTIMENT_LABELS) if str(label).lower().startswith("pos")), None
)
NEG_LABEL_INDEX = next(
    (idx for idx, label in enumerate(SENTIMENT_LABELS) if str(label).lower().startswith("neg")), None
)


def _binary_sentiment_from_probs(prob_row: np.ndarray, labels: List[str]) -> tuple[str, float]:
    """
    Extract binary sentiment (pos/neg) from probability row.
    Always returns pos or neg, never neutral.
    """
    # Find pos/neg indices
    pos_idx = next((i for i, l in enumerate(labels) if str(l).lower().startswith("pos")), -1)
    neg_idx = next((i for i, l in enumerate(labels) if str(l).lower().startswith("neg")), -1)
    
    if pos_idx != -1 and neg_idx != -1 and pos_idx < len(prob_row) and neg_idx < len(prob_row):
        pos_prob = float(prob_row[pos_idx])
        neg_prob = float(prob_row[neg_idx])
        if np.isnan(pos_prob) or np.isnan(neg_prob):
            return "pos", 0.5
        if pos_prob >= neg_prob:
            return "pos", pos_prob
        return "neg", neg_prob
    
    # Fallback: use argmax and map to pos/neg
    idx = int(np.argmax(prob_row))
    label = str(labels[idx]).lower()
    if label.startswith("pos"):
        return "pos", float(prob_row[idx])
    if label.startswith("neg"):
        return "neg", float(prob_row[idx])
    
    # Default to positive if cannot determine
    return "pos", 0.5


EMBED_BUNDLE = ModelBundle(MODEL_PATH, TOKENIZER_PATH)
SENTIMENT_BUNDLE = ClassificationBundle(
    SENTIMENT_MODEL_PATH, SENTIMENT_TOKENIZER_PATH
)


# ---------------------------------------------------------------------------
# Request / response schemas
# ---------------------------------------------------------------------------
class PredictRequest(BaseModel):
    text: str = Field(..., description="Single text to embed")

    @validator("text")
    def _validate_text(cls, value: str) -> str:
        if not value or not value.strip():
            raise ValueError("text must not be empty")
        return value


class PredictBatchRequest(BaseModel):
    texts: List[str]

    @validator("texts")
    def _validate_texts(cls, value: List[str]) -> List[str]:
        filtered = [t for t in value if isinstance(t, str) and t.strip()]
        if not filtered:
            raise ValueError("texts must contain at least one non-empty string")
        return filtered


class SimilarityRequest(BaseModel):
    text1: str
    text2: str

    @validator("text1", "text2")
    def _validate_text(cls, value: str) -> str:
        if not value or not value.strip():
            raise ValueError("text must not be empty")
        return value


class SentimentRequest(BaseModel):
    texts: List[str]

    @validator("texts")
    def _validate_texts(cls, value: List[str]) -> List[str]:
        filtered = [t for t in value if isinstance(t, str) and t.strip()]
        if not filtered:
            raise ValueError("texts must contain at least one non-empty string")
        return filtered


class CommentItem(BaseModel):
    """Individual comment item for video detail analysis."""
    comment_id: str
    text: str
    like_count: int = 0


class VideoDetailRequest(BaseModel):
    video_id: str
    title: str = ""
    description: str = ""
    comments: List[Union[Dict[str, Any], CommentItem]] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Bento Service
# ---------------------------------------------------------------------------
@bentoml.service(name="simcse_onnx_service")
class SimCSEService:
    def __init__(self):
        self.embed_bundle = EMBED_BUNDLE
        self.sentiment_bundle = SENTIMENT_BUNDLE
        self._warmed_up = False
        self._warmup_lock = threading.Lock()
        if ENABLE_STARTUP_WARMUP:
            threading.Thread(target=self._safe_warmup, name="simcse-warmup", daemon=True).start()

    def _safe_warmup(self) -> None:
        if self._warmed_up:
            return
        with self._warmup_lock:
            if self._warmed_up:
                return
            try:
                logger.info("[BentoService] Running startup warmup...")
                # Run a small embedding + sentiment request so that ONNX sessions are ready
                self.embed_bundle.encode([WARMUP_SAMPLE_TEXT, "여행 테스트 문장"])
                self.sentiment_bundle.logits([WARMUP_SAMPLE_TEXT, "여행 감성 테스트"])
                self._warmed_up = True
                logger.info("[BentoService] Warmup completed successfully")
            except Exception as exc:
                logger.warning("[BentoService] Warmup failed: %s", exc)

    @bentoml.api(route="/health")
    def health(self) -> Dict[str, Any]:
        """
        Legacy health endpoint.
        """
        return {
            "status": "ok",
            "model_path": str(MODEL_PATH),
            "tokenizer_path": str(TOKENIZER_PATH),
            "sentiment_model_path": str(SENTIMENT_MODEL_PATH),
            "sentiment_tokenizer_path": str(SENTIMENT_TOKENIZER_PATH),
            "dimension": self.embed_bundle.hidden_dim,
            "warmed_up": self._warmed_up,
        }

    @bentoml.api(route="/predict")
    def predict(self, request: PredictRequest) -> Dict[str, Any]:
        """
        Single sentence embedding (compatible with existing /predict contract).
        Response keeps the original double-nested `vector` structure so the
        FastAPI backend parsing logic can stay unchanged.
        """
        embedding = self.embed_bundle.encode([request.text])[0]
        return {
            "vector": [embedding.tolist()],  # legacy payload (list of list)
            "dim": len(embedding),
            "normalized": NORMALIZE,
        }

    @bentoml.api(route="/predict/batch")
    def predict_batch(self, request: PredictBatchRequest) -> Dict[str, Any]:
        """
        Batch embeddings (useful for offline pipelines).
        """
        try:
            embeddings = self.embed_bundle.encode(request.texts)
            return {
                "vectors": embeddings.tolist(),
                "count": len(request.texts),
                "dim": embeddings.shape[-1],
                "normalized": NORMALIZE,
            }
        except Exception as e:
            error_trace = traceback.format_exc()
            logger.error("[BentoService] Error in predict_batch: %s\n%s", str(e), error_trace)
            raise

    @bentoml.api(route="/similarity")
    def similarity(self, request: SimilarityRequest) -> Dict[str, Any]:
        """
        Cosine similarity between two texts (same semantics as legacy server).
        """
        try:
            embeddings = self.embed_bundle.encode([request.text1, request.text2])
            vec1, vec2 = embeddings[0], embeddings[1]
            sim = float(
                np.dot(vec1, vec2) / (np.linalg.norm(vec1) * np.linalg.norm(vec2) + 1e-9)
            )
            return {"similarity": sim}
        except Exception as e:
            error_trace = traceback.format_exc()
            logger.error("[BentoService] Error in similarity: %s\n%s", str(e), error_trace)
            raise

    @bentoml.api(route="/sentiment")
    def sentiment(self, request: SentimentRequest) -> Dict[str, Any]:
        logits = self.sentiment_bundle.logits(request.texts)
        probs = softmax(logits, axis=1)
        results: List[Dict[str, Any]] = []
        for text, row in zip(request.texts, probs):
            idx = int(np.argmax(row))
            results.append(
                {
                    "text": text,
                    "label": SENTIMENT_LABELS[idx],
                    "score": float(row[idx]),
                    "scores": {
                        label: float(score) for label, score in zip(SENTIMENT_LABELS, row)
                    },
                }
            )
        return {"results": results}

    @bentoml.api(route="/v1/video-detail")
    def video_detail(self, request: VideoDetailRequest) -> Dict[str, Any]:
        """
        Analyze video comments and return sentiment ratio, top comments, and keywords.
        
        Returns:
            {
                "video_id": str,
                "sentiment_ratio": {"pos": float, "neu": float, "neg": float},
                "top_comments": List[Dict],
                "top_keywords": List[Dict],
                "model": {"sentiment_model": str, "version": str}
            }
        """
        try:
            # BentoML이 자동으로 VideoDetailRequest로 파싱함 (다른 엔드포인트와 동일한 패턴)
            parsed_request = request
            
            logger.info("[BentoService] video_detail called: video_id=%s, comments_count=%d", 
                       parsed_request.video_id, len(parsed_request.comments) if parsed_request.comments else 0)
        
            # Convert comment dicts to CommentItem objects for easier access
            comment_items = []
            for c in parsed_request.comments:
                try:
                    if isinstance(c, dict):
                        comment_items.append(CommentItem(
                            comment_id=str(c.get("comment_id", "")),
                            text=str(c.get("text", "")),
                            like_count=int(c.get("like_count", 0))
                        ))
                    elif isinstance(c, CommentItem):
                        comment_items.append(c)
                    else:
                        logger.warning("[BentoService] Unexpected comment type: %s", type(c))
                except Exception as e:
                    logger.error("[BentoService] Failed to parse comment: %s, error: %s", c, e)
                    continue
            
            if not comment_items:
                logger.warning("[BentoService] No comments provided for video %s", parsed_request.video_id)
                return {
                    "video_id": parsed_request.video_id,
                    "sentiment_ratio": {"pos": 0.0, "neu": 0.0, "neg": 0.0},
                    "top_comments": [],
                    "top_keywords": [],
                    "model": {"sentiment_model": "sentiment_onnx", "version": "v1"},
                }
            
            # Extract comment texts and keep track of valid comment indices
            valid_comments = []
            comment_texts = []
            for i, c in enumerate(comment_items):
                text = c.text
                if text and text.strip():
                    valid_comments.append((i, c))
                    comment_texts.append(text)
            
            logger.info("[BentoService] Valid comments: %d/%d (with non-empty text)", 
                       len(comment_texts), len(comment_items))
            
            if not comment_texts:
                logger.warning("[BentoService] No valid comment texts found for video %s (all empty or whitespace)", parsed_request.video_id)
                return {
                    "video_id": parsed_request.video_id,
                    "sentiment_ratio": {"pos": 0.0, "neu": 0.0, "neg": 0.0},
                    "top_comments": [],
                    "top_keywords": [],
                    "model": {"sentiment_model": "sentiment_onnx", "version": "v1"},
                }
            
            # Perform sentiment analysis
            logger.info("[BentoService] Performing sentiment analysis on %d comments", len(comment_texts))
            logits = self.sentiment_bundle.logits(comment_texts)
            probs = softmax(logits, axis=1)
            logger.info("[BentoService] Sentiment analysis completed, processing results...")
            
            # Calculate sentiment ratio (binary: positive / negative only, no neutral)
            sentiment_counts = {"pos": 0, "neg": 0}
            comment_results = []
            
            # Map SENTIMENT_LABELS to short labels (only pos/neg, no neutral)
            label_map = {"positive": "pos", "negative": "neg"}
            
            # Find indices for positive and negative only (no neutral)
            pos_idx = -1
            neg_idx = -1
            
            for i, label in enumerate(SENTIMENT_LABELS):
                label_lower = str(label).lower()
                if label_lower.startswith("pos"):
                    pos_idx = i
                elif label_lower.startswith("neg"):
                    neg_idx = i
                # Skip neutral - we don't predict it
            
            for (orig_idx, comment), prob_row in zip(valid_comments, probs):
                # Use helper function for binary sentiment classification
                label_short, score = _binary_sentiment_from_probs(prob_row, SENTIMENT_LABELS)
                
                # Log for debugging (first few comments only)
                if orig_idx < 3:
                    logger.info(
                        "[BentoService] Comment %d: label=%s, score=%.4f, text_preview=%.50s",
                        orig_idx, label_short, score, comment.text[:50] if comment.text else ""
                    )
                
                sentiment_counts[label_short] += 1
                
                comment_results.append({
                    "comment_id": comment.comment_id,
                    "text": comment.text,
                    "like_count": comment.like_count,
                    "label": label_short,
                    "score": score,
                })
            
            binary_comments = [c for c in comment_results if c["label"] in {"pos", "neg"}]
            binary_total = len(binary_comments)
            if binary_total == 0:
                binary_total = len(comment_results)
                binary_comments = comment_results[:]
            
            pos_count = sum(1 for c in binary_comments if c["label"] == "pos")
            neg_count = sum(1 for c in binary_comments if c["label"] == "neg")
            total_binary = pos_count + neg_count
            sentiment_ratio = {
                "pos": pos_count / total_binary if total_binary > 0 else 0.0,
                "neu": 0.0,
                "neg": neg_count / total_binary if total_binary > 0 else 0.0,
            }
            
            # Get top comments (binary first, fallback to all)
            top_source = binary_comments if binary_comments else comment_results
            top_comments = sorted(
                top_source,
                key=lambda x: (x["like_count"], x["score"]),
                reverse=True
            )[:20]
            
            # Extract keywords from comment texts (simple frequency-based)
            # For now, we'll use a simple approach: extract common words
            # In production, you might want to use more sophisticated keyword extraction
            
            # Extract Korean and English words
            words = []
            for text in comment_texts:
                # Simple word extraction (Korean + English)
                word_pattern = r'[\uac00-\ud7a3]+|[a-zA-Z]+'
                words.extend(re.findall(word_pattern, text.lower()))
            
            # Filter out common stop words (simple list)
            stop_words = {"이", "가", "을", "를", "의", "에", "와", "과", "도", "로", "으로", "는", "은", "the", "a", "an", "and", "or", "but"}
            filtered_words = [w for w in words if len(w) > 1 and w not in stop_words]
            
            # Count word frequencies
            word_counts = Counter(filtered_words)
            top_keywords = [
                {"keyword": word, "weight": float(count)}
                for word, count in word_counts.most_common(12)
            ]
            
            logger.info("[BentoService] Results: sentiment_ratio=%s, top_comments=%d, top_keywords=%d",
                       sentiment_ratio, len(top_comments), len(top_keywords))
            
            return {
                "video_id": parsed_request.video_id,
                "sentiment_ratio": sentiment_ratio,
                "top_comments": top_comments,
                "top_keywords": top_keywords,
                "model": {"sentiment_model": "sentiment_onnx", "version": "v1"},
            }
        except Exception as e:
            error_trace = traceback.format_exc()
            try:
                video_id = getattr(request, "video_id", "unknown")
            except Exception:
                video_id = "unknown"
            logger.error("[BentoService] Error in video_detail for %s: %s\n%s", video_id, str(e), error_trace)
            # Return default response on error
            return {
                "video_id": video_id,
                "sentiment_ratio": {"pos": 0.0, "neu": 0.0, "neg": 0.0},
                "top_comments": [],
                "top_keywords": [],
                "model": {"sentiment_model": "sentiment_onnx", "version": "v1"},
                "error": str(e)  # Include error message for debugging
            }


