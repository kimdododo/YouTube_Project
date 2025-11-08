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

# 환경 변수 확인을 위한 스크립트
RUN echo "Dockerfile: Backend ready" > /tmp/backend_ready.txt

# Cloud Run은 PORT 환경 변수를 제공하므로 이를 사용
# 프로덕션 모드로 실행 (reload 제거)
ENV PORT=8080
ENV PYTHONPATH=/app
EXPOSE 8080

# 시작 스크립트 생성 (마이그레이션 + 서버 시작)
RUN echo '#!/bin/bash\n\
set -e\n\
export PYTHONPATH=/app\n\
echo "Running database migrations..."\n\
echo "[DEBUG] Environment variables before migration:"\n\
echo "  DB_HOST=${DB_HOST:-not set}"\n\
echo "  DB_USER=${DB_USER:-not set}"\n\
echo "  DB_NAME=${DB_NAME:-not set}"\n\
echo "  DB_PORT=${DB_PORT:-not set}"\n\
echo "  DB_PASSWORD=${DB_PASSWORD:+***set***}"\n\
cd /app && alembic upgrade head || echo "Migration failed, continuing..."\n\
echo "Starting FastAPI server on port ${PORT:-8080}..."\n\
exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8080}\n\
' > /app/start.sh && chmod +x /app/start.sh

CMD ["/app/start.sh"]

