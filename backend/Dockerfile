FROM python:3.11-slim

WORKDIR /app

# 시스템 패키지 설치
RUN apt-get update && apt-get install -y \
    gcc \
    default-libmysqlclient-dev \
    pkg-config \
    && rm -rf /var/lib/apt/lists/*

# Python 패키지 설치
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 애플리케이션 코드 복사
COPY . .

# Python 캐시 제거 (배포된 이미지에서 이전 버전의 .pyc 파일이 문제를 일으킬 수 있음)
RUN find . -type d -name __pycache__ -exec rm -r {} + 2>/dev/null || true
RUN find . -type f -name "*.pyc" -delete 2>/dev/null || true
RUN find . -type f -name "*.pyo" -delete 2>/dev/null || true

# 환경 변수 확인을 위한 스크립트
RUN echo "Dockerfile: Backend ready" > /tmp/backend_ready.txt

# Cloud Run은 PORT 환경 변수를 제공하므로 이를 사용
# 프로덕션 모드로 실행 (reload 제거)
ENV PORT=8080
ENV PYTHONPATH=/app
EXPOSE 8080

# 시작 스크립트 생성 (마이그레이션 + 서버 시작)
RUN echo '#!/bin/bash\n\
set -euo pipefail\n\
export PYTHONPATH=/app\n\
echo "=== Backend Startup Script ==="\n\
echo "Timestamp: $(date)"\n\
echo "[DEBUG] Environment variables:"\n\
echo "  DB_HOST=${DB_HOST:-not set}"\n\
echo "  DB_USER=${DB_USER:-not set}"\n\
echo "  DB_NAME=${DB_NAME:-not set}"\n\
echo "  DB_PORT=${DB_PORT:-not set}"\n\
echo "  DB_PASSWORD=${DB_PASSWORD:+***set***}"\n\
echo "  PORT=${PORT:-8080}"\n\
echo "  PYTHONPATH=${PYTHONPATH}"\n\
echo "  BENTO_BASE_URL=${BENTO_BASE_URL:-not set}"\n\
cd /app || { echo "❌ Failed to cd to /app"; exit 1; }\n\
echo "Current directory: $(pwd)"\n\
echo "Python version: $(python --version)"\n\
echo "Uvicorn location: $(which uvicorn || echo not found)"\n\
echo "Testing Python imports..."\n\
python -c "import sys; print(f\"Python path: {sys.path}\")" || { echo "⚠️ Python path check failed"; }\n\
python -c "import app.main; print(\"✅ app.main imported successfully\")" || { echo "❌ Failed to import app.main"; python -c "import traceback; traceback.print_exc()"; exit 1; }\n\
echo "Testing critical dependencies..."\n\
python -c "import httpx; print(\"✅ httpx imported\")" || { echo "❌ httpx not found"; exit 1; }\n\
python -c "import fastapi; print(\"✅ fastapi imported\")" || { echo "❌ fastapi not found"; exit 1; }\n\
python -c "import uvicorn; print(\"✅ uvicorn imported\")" || { echo "❌ uvicorn not found"; exit 1; }\n\
echo "Running database migrations..."\n\
MIGRATION_START=$(date +%s)\n\
# 마이그레이션 실행 (타임아웃 없이, 실패해도 계속 진행)\n\
if timeout 60 alembic upgrade head 2>&1; then\n\
  MIGRATION_END=$(date +%s)\n\
  MIGRATION_DURATION=$((MIGRATION_END - MIGRATION_START))\n\
  echo "✅ Database migrations completed successfully in ${MIGRATION_DURATION}s"\n\
else\n\
  MIGRATION_EXIT_CODE=$?\n\
  MIGRATION_END=$(date +%s)\n\
  MIGRATION_DURATION=$((MIGRATION_END - MIGRATION_START))\n\
  echo "⚠️ Migration failed after ${MIGRATION_DURATION}s (exit code: $MIGRATION_EXIT_CODE)"\n\
  echo "⚠️ Continuing with server start despite migration failure..."\n\
fi\n\
PORT=${PORT:-8080}\n\
echo "Starting FastAPI server on port ${PORT}..."\n\
echo "Server start time: $(date)"\n\
echo "PORT environment variable: ${PORT}"\n\
echo "Testing port binding..."\n\
python -c "import socket; s = socket.socket(); s.bind((\"0.0.0.0\", ${PORT})); s.close(); print(f\"✅ Port ${PORT} is available\")" || { echo "❌ Port ${PORT} is not available"; exit 1; }\n\
# Cloud Run이 PORT 환경 변수를 제공하므로 반드시 사용\n\
# Python으로 직접 실행하여 더 나은 에러 메시지 확인\n\
echo "🚀 Launching uvicorn..."\n\
exec python -m uvicorn app.main:app --host 0.0.0.0 --port ${PORT} --timeout-keep-alive 30 --log-level info --access-log --no-use-colors\n\
' > /app/start.sh && chmod +x /app/start.sh

CMD ["/app/start.sh"]

