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
from pathlib import Path
from typing import Any, Dict, List

import bentoml
import numpy as np
import onnxruntime as ort
from pydantic import BaseModel, Field, validator
from transformers import AutoTokenizer

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
EMBED_MODEL_DIR = Path(os.getenv("EMBED_MODEL_DIR", "models/simcse"))
SENTIMENT_MODEL_DIR = Path(os.getenv("SENTIMENT_MODEL_DIR", "models/sentiment"))
DEFAULT_MODEL_PATH = Path(os.getenv("MODEL_PATH", EMBED_MODEL_DIR / "model.onnx"))
DEFAULT_TOKENIZER_PATH = Path(
    os.getenv("TOKENIZER_PATH", EMBED_MODEL_DIR / "tokenizer")
)
DEFAULT_SENTIMENT_MODEL_PATH = Path(
    os.getenv("SENTIMENT_MODEL_PATH", SENTIMENT_MODEL_DIR / "model.onnx")
)
DEFAULT_SENTIMENT_TOKENIZER_PATH = Path(
    os.getenv(
        "SENTIMENT_TOKENIZER_PATH", SENTIMENT_MODEL_DIR / "tokenizer"
    )
)
SENTIMENT_LABELS = ["negative", "neutral", "positive"]
MAX_SEQ_LENGTH = int(os.getenv("MAX_SEQ_LENGTH", "256"))
NORMALIZE = os.getenv("NORMALIZE_EMBEDDINGS", "true").lower() in {"1", "true", "yes"}


def _ensure_file(path: Path, description: str) -> Path:
    if not path.exists():
        raise FileNotFoundError(f"{description} not found at {path}")
    return path


def _ensure_dir(path: Path, description: str) -> Path:
    if not path.exists() or not path.is_dir():
        raise FileNotFoundError(f"{description} not found at {path}")
    return path


MODEL_PATH = _ensure_file(DEFAULT_MODEL_PATH, "SimCSE ONNX model")
TOKENIZER_PATH = _ensure_dir(
    DEFAULT_TOKENIZER_PATH, "SimCSE tokenizer directory"
)
SENTIMENT_MODEL_PATH = _ensure_file(
    DEFAULT_SENTIMENT_MODEL_PATH, "Sentiment ONNX model"
)
SENTIMENT_TOKENIZER_PATH = _ensure_dir(
    DEFAULT_SENTIMENT_TOKENIZER_PATH, "Sentiment tokenizer directory"
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


