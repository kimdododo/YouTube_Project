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

# 시작 스크립트 복사 및 실행 권한 부여
COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh

CMD ["/app/start.sh"]

