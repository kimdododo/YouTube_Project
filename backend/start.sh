#!/bin/bash
set -euo pipefail
export PYTHONPATH=/app

echo "=== Backend Startup Script ==="
echo "Timestamp: $(date)"
echo "[DEBUG] Environment variables:"
echo "  DB_HOST=${DB_HOST:-not set}"
echo "  DB_USER=${DB_USER:-not set}"
echo "  DB_NAME=${DB_NAME:-not set}"
echo "  DB_PORT=${DB_PORT:-not set}"
echo "  DB_PASSWORD=${DB_PASSWORD:+***set***}"
echo "  PORT=${PORT:-8080}"
echo "  PYTHONPATH=${PYTHONPATH}"
echo "  BENTO_BASE_URL=${BENTO_BASE_URL:-not set}"

cd /app || { echo "❌ Failed to cd to /app"; exit 1; }
echo "Current directory: $(pwd)"
echo "Python version: $(python --version)"
echo "Uvicorn location: $(which uvicorn || echo not found)"

echo "Testing Python imports..."
python -c "import sys; print(f'Python path: {sys.path}')" || { echo "⚠️ Python path check failed"; }
python -c "import app.main; print('✅ app.main imported successfully')" || { echo "❌ Failed to import app.main"; python -c "import traceback; traceback.print_exc()"; exit 1; }

echo "Testing critical dependencies..."
python -c "import httpx; print('✅ httpx imported')" || { echo "❌ httpx not found"; exit 1; }
python -c "import fastapi; print('✅ fastapi imported')" || { echo "❌ fastapi not found"; exit 1; }
python -c "import uvicorn; print('✅ uvicorn imported')" || { echo "❌ uvicorn not found"; exit 1; }

echo "Running database migrations..."
MIGRATION_START=$(date +%s)
# 마이그레이션 실행 (타임아웃 없이, 실패해도 계속 진행)
if timeout 60 alembic upgrade head 2>&1; then
  MIGRATION_END=$(date +%s)
  MIGRATION_DURATION=$((MIGRATION_END - MIGRATION_START))
  echo "✅ Database migrations completed successfully in ${MIGRATION_DURATION}s"
else
  MIGRATION_EXIT_CODE=$?
  MIGRATION_END=$(date +%s)
  MIGRATION_DURATION=$((MIGRATION_END - MIGRATION_START))
  echo "⚠️ Migration failed after ${MIGRATION_DURATION}s (exit code: $MIGRATION_EXIT_CODE)"
  echo "⚠️ Continuing with server start despite migration failure..."
fi

PORT=${PORT:-8080}
echo "Starting FastAPI server on port ${PORT}..."
echo "Server start time: $(date)"
echo "PORT environment variable: ${PORT}"

echo "Testing port binding..."
python -c "import socket; s = socket.socket(); s.bind(('0.0.0.0', ${PORT})); s.close(); print(f'✅ Port ${PORT} is available')" || { echo "❌ Port ${PORT} is not available"; exit 1; }

# Cloud Run이 PORT 환경 변수를 제공하므로 반드시 사용
# Python으로 직접 실행하여 더 나은 에러 메시지 확인
echo "🚀 Launching uvicorn..."
echo "Uvicorn command: python -m uvicorn app.main:app --host 0.0.0.0 --port ${PORT} --timeout-keep-alive 30 --log-level info --access-log --no-use-colors"

# uvicorn을 exec로 실행 (PID 1이 되도록)
exec python -m uvicorn app.main:app --host 0.0.0.0 --port ${PORT} --timeout-keep-alive 30 --log-level info --access-log --no-use-colors

