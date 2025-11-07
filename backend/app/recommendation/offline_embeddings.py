from typing import List
from sentence_transformers import SentenceTransformer


class EmbeddingEncoder:
    def __init__(self, model_name: str = "ko_sroberta"):
        if model_name == "ko_sroberta":
            path = "backend/models/embeddings/ko_sroberta"
        elif model_name == "e5_base":
            path = "backend/models/embeddings/e5_base"
        else:
            raise ValueError("Unknown embedding model")
        # SentenceTransformer loads local if folder path provided
        self.model = SentenceTransformer(path)

    def encode(self, texts: List[str]) -> List[List[float]]:
        return self.model.encode(texts, normalize_embeddings=True).tolist()


