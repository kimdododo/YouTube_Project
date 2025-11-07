from transformers import AutoTokenizer, AutoModelForSequenceClassification
import torch

MODEL_DIR = "backend/models/profanity/kcelectra"


class ProfanityFilter:
    def __init__(self):
        self.tokenizer = AutoTokenizer.from_pretrained(MODEL_DIR, local_files_only=True)
        self.model = AutoModelForSequenceClassification.from_pretrained(MODEL_DIR, local_files_only=True)
        self.model.eval()

    @torch.inference_mode()
    def score(self, text: str) -> float:
        """Return probability of toxic/abusive class if available; otherwise 0/1 proxy."""
        inputs = self.tokenizer(text, return_tensors="pt", truncation=True, max_length=256)
        logits = self.model(**inputs).logits
        probs = torch.softmax(logits, dim=-1).squeeze(0).cpu().tolist()
        # assume last index = toxic
        return float(probs[-1]) if len(probs) > 1 else float(probs[0])


