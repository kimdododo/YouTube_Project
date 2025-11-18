"""
Utility for generating comment summaries using a HuggingFace summarization model.
"""
from __future__ import annotations

import os
import re
from typing import List

from transformers import pipeline

_SUMMARY_PIPELINE = None


def _get_summarizer():
    """
    Lazily initialize and cache the HuggingFace summarization pipeline.
    """
    global _SUMMARY_PIPELINE

    if _SUMMARY_PIPELINE is None:
        model_name = os.getenv("COMMENT_SUMMARY_MODEL", "sshleifer/distilbart-cnn-6-6")
        device_str = os.getenv("COMMENT_SUMMARY_DEVICE", "cpu").lower()

        # HuggingFace pipeline uses -1 for CPU, non-negative int for CUDA device index
        device = 0 if device_str.startswith("cuda") else -1

        print(f"[RAG] Loading comment summary model: {model_name} (device={device_str})")
        _SUMMARY_PIPELINE = pipeline(
            "summarization",
            model=model_name,
            device=device,
        )
        print("[RAG] Comment summary model loaded successfully")

    return _SUMMARY_PIPELINE


def generate_comment_summary(
    comments: List[str],
    max_sentences: int = 3,
) -> List[str]:
    """
    Generate a short summary from a list of comment texts using a HuggingFace model.
    """
    if not comments:
        return []

    # Combine a subset of comments to avoid extremely long context
    max_comments = int(os.getenv("COMMENT_SUMMARY_MAX_COMMENTS", "40"))
    selected = [c.strip() for c in comments if c and c.strip()]
    if not selected:
        return []

    combined = " ".join(selected[:max_comments])
    max_chars = int(os.getenv("COMMENT_SUMMARY_MAX_CHARS", "2000"))
    if len(combined) > max_chars:
        combined = combined[:max_chars]

    summarizer = _get_summarizer()

    max_length = int(os.getenv("COMMENT_SUMMARY_MAX_TOKENS", "130"))
    min_length = int(os.getenv("COMMENT_SUMMARY_MIN_TOKENS", "40"))

    try:
        result = summarizer(
            combined,
            max_length=max_length,
            min_length=min_length,
            do_sample=False,
            clean_up_tokenization_spaces=True,
        )
        if not result:
            return []

        summary_text = result[0].get("summary_text", "").strip()
        if not summary_text:
            return []

        # Split into sentences and return up to max_sentences items
        sentences = re.split(r"(?<=[.!?])\s+", summary_text)
        sentences = [s.strip() for s in sentences if s.strip()]
        return sentences[:max_sentences] if sentences else [summary_text]
    except Exception as exc:
        print(f"[WARN] HuggingFace summarization failed: {exc}")
        return []


