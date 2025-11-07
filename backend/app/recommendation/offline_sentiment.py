from transformers import AutoTokenizer, AutoModelForSequenceClassification
import torch

MODEL_DIR = "backend/models/sentiment/koelectra"  # daekeun-ml/koelectra-small-finetuned-sentiment


class SentimentScorer:
    def __init__(self):
        self.tokenizer = AutoTokenizer.from_pretrained(MODEL_DIR, local_files_only=True)
        self.model = AutoModelForSequenceClassification.from_pretrained(MODEL_DIR, local_files_only=True)
        self.model.eval()

    @torch.inference_mode()
    def score_batch(self, texts, batch_size: int = 64):
        results = []
        for i in range(0, len(texts), batch_size):
            batch = texts[i:i+batch_size]
            inp = self.tokenizer(batch, return_tensors="pt", padding=True, truncation=True, max_length=256)
            logits = self.model(**inp).logits
            probs = torch.softmax(logits, dim=-1).cpu().tolist()
            for p in probs:
                # assume [neg, neu, pos] or [neg, pos]
                if len(p) == 3:
                    neg, neu, pos = p
                elif len(p) == 2:
                    neg, pos = p
                    neu = 0.0
                else:
                    # fallback single-class
                    neg, neu, pos = 0.0, 0.0, p[-1]
                label = "positive" if pos >= max(neg, neu) else ("negative" if neg >= max(neu, pos) else "neutral")
                score = pos - neg  # [-1,1] 근사
                results.append((label, float(score), float(pos)))
        return results


