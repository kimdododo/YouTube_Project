from transformers import AutoTokenizer, AutoModelForSeq2SeqLM

MODEL_DIR = "backend/models/keyword/kobart"


class KeywordExtractor:
    def __init__(self):
        self.tokenizer = AutoTokenizer.from_pretrained(MODEL_DIR, local_files_only=True)
        self.model = AutoModelForSeq2SeqLM.from_pretrained(MODEL_DIR, local_files_only=True)
        self.model.eval()

    def extract(self, text: str, max_len: int = 64) -> str:
        prompt = f"키워드: {text}"
        inputs = self.tokenizer([prompt], return_tensors="pt", truncation=True, max_length=256)
        outputs = self.model.generate(**inputs, num_beams=4, max_length=max_len)
        decoded = self.tokenizer.batch_decode(outputs, skip_special_tokens=True)[0]
        return decoded.strip()


