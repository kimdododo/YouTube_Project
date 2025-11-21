#!/bin/bash
set -x
export PYTHONPATH=/app

echo "=== Backend Startup Script ==="
echo "Timestamp: $(date)"
echo "[DEBUG] Environment variables:"
echo "  DB_HOST=${DB_HOST:-not set}"
echo "  DB_USER=${DB_USER:-not set}"
echo "  DB_NAME=${DB_NAME:-not set}"
echo "  DB_PORT=${DB_PORT:-not set}"
echo "  DB_PASSWORD=${DB_PASSWORD:+***set***}"
echo "  USE_CLOUD_SQL_CONNECTOR=${USE_CLOUD_SQL_CONNECTOR:-not set}"
echo "  CLOUD_SQL_INSTANCE=${CLOUD_SQL_INSTANCE:-not set}"
echo "  PORT=${PORT:-8080}"
echo "  PYTHONPATH=${PYTHONPATH}"
echo "  BENTO_BASE_URL=${BENTO_BASE_URL:-not set}"

cd /app
echo "Current directory: $(pwd)"
echo "Python version: $(python --version)"

echo "Testing Python imports..."
python -c "import app.main; print('✅ app.main imported successfully')" || {
  echo "❌ Failed to import app.main"
  python -c "import traceback; traceback.print_exc()"
  exit 1
}

echo "Testing critical dependencies..."
python -c "import httpx; print('✅ httpx imported')" || { echo "❌ httpx not found"; exit 1; }
python -c "import fastapi; print('✅ fastapi imported')" || { echo "❌ fastapi not found"; exit 1; }
python -c "import uvicorn; print('✅ uvicorn imported')" || { echo "❌ uvicorn not found"; exit 1; }

echo "Running database migrations (this will test database connection)..."
echo "=========================================="

# 데이터베이스에 잘못된 revision이 기록되어 있는지 확인하고 수정
echo "Checking and fixing alembic_version table if needed..."
if python fix_alembic_version.py 2>&1; then
  echo "[INFO] Alembic version check completed"
else
  echo "[WARN] Failed to check alembic_version table, but continuing..."
fi

MIGRATION_OUTPUT=$(alembic upgrade head 2>&1)
MIGRATION_EXIT_CODE=$?
if [ $MIGRATION_EXIT_CODE -eq 0 ]; then
  echo "✅ Database migrations completed successfully"
  echo "$MIGRATION_OUTPUT"
else
  echo "❌ Migration failed (exit code: $MIGRATION_EXIT_CODE)"
  echo "=========================================="
  echo "Migration output:"
  echo "$MIGRATION_OUTPUT"
  echo "=========================================="
  echo "This indicates a database connection or migration problem."
  echo "Please check:"
  echo "  1. Cloud SQL instance is running"
  echo "  2. Service account has Cloud SQL Client role"
  echo "  3. VPC connector is properly configured"
  echo "  4. Environment variables are set correctly"
  echo "  5. Migration files are correct (check for missing down_revision)"
  exit $MIGRATION_EXIT_CODE
fi
echo "=========================================="

PORT=${PORT:-8080}
echo "Starting FastAPI server on port ${PORT}..."
echo "Server start time: $(date)"

# Cloud Run이 PORT 환경 변수를 제공하므로 반드시 사용
echo "🚀 Launching uvicorn..."
exec python -m uvicorn app.main:app --host 0.0.0.0 --port ${PORT} --timeout-keep-alive 30 --log-level info --access-log --no-use-colors
