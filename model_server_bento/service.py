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

import os
import re
from collections import Counter
from pathlib import Path
from typing import Any, Dict, List

import bentoml
import numpy as np
import onnxruntime as ort
from pydantic import BaseModel, Field, validator
from transformers import AutoTokenizer
from google.cloud import storage

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
SENTIMENT_LABELS = ["negative", "neutral", "positive"]
MAX_SEQ_LENGTH = int(os.getenv("MAX_SEQ_LENGTH", "256"))
NORMALIZE = os.getenv("NORMALIZE_EMBEDDINGS", "true").lower() in {"1", "true", "yes"}


_storage_client = None


def _get_storage_client() -> storage.Client:
    global _storage_client
    if _storage_client is None:
        _storage_client = storage.Client()
    return _storage_client


def _download_from_gcs(gcs_uri: str, cache_subdir: str, is_file: bool) -> Path:
    if not gcs_uri.startswith("gs://"):
        raise ValueError(f"Invalid GCS URI: {gcs_uri}")

    bucket_path = gcs_uri[5:]
    if "/" not in bucket_path:
        raise ValueError(f"GCS URI must include object path: {gcs_uri}")

    bucket_name, object_path = bucket_path.split("/", 1)
    cache_dir = MODEL_CACHE_ROOT / cache_subdir
    cache_dir.mkdir(parents=True, exist_ok=True)

    target_root = cache_dir / Path(object_path).name
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

    def encode(self, texts: List[str]) -> np.ndarray:
        encoded = self.tokenizer(
            texts,
            return_tensors="np",
            padding=True,
            truncation=True,
            max_length=MAX_SEQ_LENGTH,
        )
        # onnxruntime only accepts int64 for ids/masks
        inputs = {
            "input_ids": encoded["input_ids"].astype(np.int64),
            "attention_mask": encoded["attention_mask"].astype(np.int64),
        }
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

    def logits(self, texts: List[str]) -> np.ndarray:
        encoded = self.tokenizer(
            texts,
            return_tensors="np",
            padding=True,
            truncation=True,
            max_length=MAX_SEQ_LENGTH,
        )
        inputs = {
            "input_ids": encoded["input_ids"].astype(np.int64),
            "attention_mask": encoded["attention_mask"].astype(np.int64),
        }
        outputs = self.session.run(None, inputs)
        return outputs[0].astype(np.float32)


def softmax(logits: np.ndarray, axis: int = -1) -> np.ndarray:
    logits = logits - np.max(logits, axis=axis, keepdims=True)
    exps = np.exp(logits)
    return exps / np.sum(exps, axis=axis, keepdims=True)


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
    comments: List[Dict[str, Any]] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Bento Service
# ---------------------------------------------------------------------------
@bentoml.service(name="simcse_onnx_service")
class SimCSEService:
    def __init__(self):
        self.embed_bundle = EMBED_BUNDLE
        self.sentiment_bundle = SENTIMENT_BUNDLE

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
        embeddings = self.embed_bundle.encode(request.texts)
        return {
            "vectors": embeddings.tolist(),
            "count": len(request.texts),
            "dim": embeddings.shape[-1],
            "normalized": NORMALIZE,
        }

    @bentoml.api(route="/similarity")
    def similarity(self, request: SimilarityRequest) -> Dict[str, Any]:
        """
        Cosine similarity between two texts (same semantics as legacy server).
        """
        embeddings = self.embed_bundle.encode([request.text1, request.text2])
        vec1, vec2 = embeddings[0], embeddings[1]
        sim = float(
            np.dot(vec1, vec2) / (np.linalg.norm(vec1) * np.linalg.norm(vec2) + 1e-9)
        )
        return {"similarity": sim}

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
        import logging
        logger = logging.getLogger(__name__)
        
        logger.info("[BentoService] video_detail called: video_id=%s, comments_count=%d", 
                   request.video_id, len(request.comments) if request.comments else 0)
        
        # Convert comment dicts to CommentItem objects for easier access
        comment_items = []
        for c in request.comments:
            if isinstance(c, dict):
                comment_items.append(CommentItem(
                    comment_id=str(c.get("comment_id", "")),
                    text=str(c.get("text", "")),
                    like_count=int(c.get("like_count", 0))
                ))
            else:
                # Already a CommentItem (shouldn't happen, but handle it)
                comment_items.append(c)
        
        if not comment_items:
            logger.warning("[BentoService] No comments provided for video %s", request.video_id)
            return {
                "video_id": request.video_id,
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
            logger.warning("[BentoService] No valid comment texts found for video %s (all empty or whitespace)", request.video_id)
            return {
                "video_id": request.video_id,
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
        
        # Calculate sentiment ratio
        sentiment_counts = {"pos": 0, "neu": 0, "neg": 0}
        comment_results = []
        
        # Map SENTIMENT_LABELS to short labels
        label_map = {"positive": "pos", "neutral": "neu", "negative": "neg"}
        
        for (orig_idx, comment), prob_row in zip(valid_comments, probs):
            idx = int(np.argmax(prob_row))
            label_long = SENTIMENT_LABELS[idx]
            label_short = label_map.get(label_long, "neu")
            sentiment_counts[label_short] += 1
            
            comment_results.append({
                "comment_id": comment.comment_id,
                "text": comment.text,
                "like_count": comment.like_count,
                "label": label_short,
                "score": float(prob_row[idx]),
            })
        
        total = len(comment_texts)
        sentiment_ratio = {
            "pos": sentiment_counts["pos"] / total if total > 0 else 0.0,
            "neu": sentiment_counts["neu"] / total if total > 0 else 0.0,
            "neg": sentiment_counts["neg"] / total if total > 0 else 0.0,
        }
        
        # Get top comments (sorted by like_count, then by sentiment score)
        top_comments = sorted(
            comment_results,
            key=lambda x: (x["like_count"], x["score"]),
            reverse=True
        )[:10]  # Top 10 comments
        
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
            "video_id": request.video_id,
            "sentiment_ratio": sentiment_ratio,
            "top_comments": top_comments,
            "top_keywords": top_keywords,
            "model": {"sentiment_model": "sentiment_onnx", "version": "v1"},
        }


