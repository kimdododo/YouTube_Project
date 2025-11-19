FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# 의존성 설치
COPY backend/requirements.txt backend/requirements.txt
COPY model_server/requirements.txt model_server/requirements.txt

RUN pip install --upgrade pip && \
    pip install --no-cache-dir -r model_server/requirements.txt

# 애플리케이션 코드 복사
COPY backend backend
COPY model_server model_server

ENV PYTHONPATH=/app/backend
EXPOSE 8200

CMD ["sh", "-c", "uvicorn model_server.main:app --host 0.0.0.0 --port ${PORT:-8200}"]

