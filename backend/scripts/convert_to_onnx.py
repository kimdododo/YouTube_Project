"""
m3_korean 모델을 ONNX로 변환하는 스크립트
"""
import os
import sys
from pathlib import Path

# 모델 경로 설정
backend_root = Path(__file__).parent.parent
model_path = backend_root / "models" / "embeddings" / "m3_korean"
output_path = model_path / "model.onnx"

try:
    from transformers import AutoTokenizer, AutoModel
    import torch
    import onnxruntime as ort
except ImportError:
    print("필요한 패키지 설치: pip install transformers torch onnxruntime")
    sys.exit(1)

print(f"📦 모델 로드: {model_path}")

# transformers로 직접 로드
print("   - 토크나이저 로드 중...")
tokenizer = AutoTokenizer.from_pretrained(str(model_path), trust_remote_code=True)

print("   - 모델 로드 중...")
model = AutoModel.from_pretrained(str(model_path), trust_remote_code=True)
model.eval()

# 더미 입력 생성 (ONNX 변환용)
dummy_input = tokenizer("테스트", return_tensors="pt", padding=True, truncation=True)

print(f"🔄 ONNX 변환 시작...")
onnx_path = str(output_path)

# ONNX로 내보내기
torch.onnx.export(
    model,
    (dummy_input["input_ids"], dummy_input["attention_mask"]),
    onnx_path,
    input_names=["input_ids", "attention_mask"],
    output_names=["last_hidden_state", "pooler_output"],
    dynamic_axes={
        "input_ids": {0: "batch_size", 1: "sequence_length"},
        "attention_mask": {0: "batch_size", 1: "sequence_length"},
        "last_hidden_state": {0: "batch_size", 1: "sequence_length"},
        "pooler_output": {0: "batch_size"}
    },
    opset_version=14,
    do_constant_folding=True,
)

print(f"✅ 변환 완료: {onnx_path}")

# 변환된 모델 검증
try:
    ort_session = ort.InferenceSession(onnx_path)
    print(f"   ✓ ONNX 모델 검증 성공")
    print(f"   - 입력: {[inp.name for inp in ort_session.get_inputs()]}")
    print(f"   - 출력: {[out.name for out in ort_session.get_outputs()]}")
except Exception as e:
    print(f"   ⚠️ ONNX 검증 실패: {e}")

