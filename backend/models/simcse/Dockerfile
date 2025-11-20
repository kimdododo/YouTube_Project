FROM python:3.11

WORKDIR /app

# 시스템 패키지 업데이트 및 필요한 도구 설치
RUN apt-get update && apt-get install -y \
    libgomp1 \
    patchelf \
    && rm -rf /var/lib/apt/lists/*

# 모델 디렉토리 생성 (런타임에 Cloud Storage에서 다운로드)
RUN mkdir -p /app/model

# 토크나이저 디렉토리 생성 (런타임에 Cloud Storage에서 다운로드)
RUN mkdir -p /app/tokenizer

# requirements.txt 복사 및 패키지 설치
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# ⚠️ 토크나이저는 런타임에 Cloud Storage에서 다운로드 (빌드 시간 단축)
# ⚠️ 빌드 시점에 HuggingFace에서 다운로드하지 않음

# ONNX Runtime 라이브러리의 executable stack 플래그 제거
RUN find /usr/local/lib/python3.11/site-packages/onnxruntime -name "*.so" -type f -exec sh -c 'patchelf --clear-execstack "$1" 2>/dev/null || true' _ {} \;

# 서버 코드 복사 (가장 마지막에 복사하여 코드 변경 시 캐시 무효화)
COPY server.py /app/server.py

# 서버 코드 검증 (디버깅용)
RUN head -15 /app/server.py && echo "---" && grep -n "import onnxruntime" /app/server.py || echo "No onnxruntime import found at module level"

# Cloud Run은 반드시 8080 포트로 HTTP 서버가 열려야 함
EXPOSE 8080

# PORT 환경 변수 사용 (Cloud Run이 자동으로 설정)
ENV PORT=8080

# uvicorn으로 FastAPI 서버 실행
CMD ["sh", "-c", "uvicorn server:app --host 0.0.0.0 --port ${PORT:-8080}"]

