"""
토크나이저 다운로드 스크립트
Docker 빌드 전에 로컬에서 실행하여 토크나이저를 다운로드
"""
from transformers import AutoTokenizer
import os

TOKENIZER_MODEL_NAME = "BM-K/KoSimCSE-roberta-multitask"
OUTPUT_DIR = "tokenizer"

if __name__ == "__main__":
    print(f"Downloading tokenizer: {TOKENIZER_MODEL_NAME}")
    tokenizer = AutoTokenizer.from_pretrained(TOKENIZER_MODEL_NAME)
    
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    tokenizer.save_pretrained(OUTPUT_DIR)
    
    print(f"Tokenizer saved to: {OUTPUT_DIR}")
    print(f"Files:")
    for file in os.listdir(OUTPUT_DIR):
        print(f"  - {file}")

