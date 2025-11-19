#!/bin/bash
# 로컬에서 Cloud Run 환경과 동일하게 테스트하는 스크립트

set -e

echo "🔨 Docker 이미지 빌드 중..."
docker build -t youtube-backend:local ./backend

echo ""
echo "📋 환경 변수 확인:"
echo "  - DB_NAME: ${DB_NAME:-yt}"
echo "  - DB_USER: ${DB_USER:-yt}"
echo "  - CLOUD_SQL_INSTANCE: ${CLOUD_SQL_INSTANCE:-swift-hangar-477802-t3:asia-northeast3:youtube}"
echo "  - USE_CLOUD_SQL_CONNECTOR: ${USE_CLOUD_SQL_CONNECTOR:-true}"
echo ""
echo "⚠️  주의사항:"
echo "  1. GCP 인증이 필요합니다: gcloud auth application-default login"
echo "  2. Cloud SQL 인스턴스에 접근 권한이 있어야 합니다"
echo "  3. 실제 시크릿 값들을 환경 변수로 설정해야 합니다"
echo ""

# 환경 변수가 설정되어 있는지 확인
if [ -z "$DB_PASSWORD" ] || [ -z "$JWT_SECRET" ] || [ -z "$OPENAI_API_KEY" ] || [ -z "$SMTP_PASSWORD" ]; then
    echo "❌ 필수 환경 변수가 설정되지 않았습니다:"
    echo "   - DB_PASSWORD"
    echo "   - JWT_SECRET"
    echo "   - OPENAI_API_KEY"
    echo "   - SMTP_PASSWORD"
    echo ""
    echo "다음 명령어로 설정하세요:"
    echo "  export DB_PASSWORD='your-password'"
    echo "  export JWT_SECRET='your-jwt-secret'"
    echo "  export OPENAI_API_KEY='your-api-key'"
    echo "  export SMTP_PASSWORD='your-smtp-password'"
    exit 1
fi

echo "🚀 컨테이너 실행 중..."
docker run --rm -p 8080:8080 \
  -e DB_NAME="${DB_NAME:-yt}" \
  -e DB_USER="${DB_USER:-yt}" \
  -e DB_PORT="${DB_PORT:-3306}" \
  -e DB_HOST="${DB_HOST:-/cloudsql/swift-hangar-477802-t3:asia-northeast3:youtube}" \
  -e CLOUD_SQL_INSTANCE="${CLOUD_SQL_INSTANCE:-swift-hangar-477802-t3:asia-northeast3:youtube}" \
  -e USE_CLOUD_SQL_CONNECTOR="${USE_CLOUD_SQL_CONNECTOR:-true}" \
  -e REDIS_URL="${REDIS_URL:-redis://10.27.151.3:6379/0}" \
  -e SMTP_HOST="${SMTP_HOST:-smtp.gmail.com}" \
  -e SMTP_PORT="${SMTP_PORT:-587}" \
  -e SMTP_USERNAME="${SMTP_USERNAME:-hyunggn68@gmail.com}" \
  -e SMTP_FROM_EMAIL="${SMTP_FROM_EMAIL:-hyunggn68@gmail.com}" \
  -e SMTP_FROM_NAME="${SMTP_FROM_NAME:-여유}" \
  -e EMAIL_VERIFICATION_CODE_EXPIRY_MINUTES="${EMAIL_VERIFICATION_CODE_EXPIRY_MINUTES:-3}" \
  -e EMAIL_VERIFICATION_CODE_LENGTH="${EMAIL_VERIFICATION_CODE_LENGTH:-6}" \
  -e EMAIL_VERIFICATION_MAX_ATTEMPTS="${EMAIL_VERIFICATION_MAX_ATTEMPTS:-5}" \
  -e LLM_MODEL="${LLM_MODEL:-gpt-4o-mini}" \
  -e LLM_TEMPERATURE="${LLM_TEMPERATURE:-0.7}" \
  -e LLM_MAX_TOKENS="${LLM_MAX_TOKENS:-160}" \
  -e DB_PASSWORD="$DB_PASSWORD" \
  -e JWT_SECRET="$JWT_SECRET" \
  -e OPENAI_API_KEY="$OPENAI_API_KEY" \
  -e SMTP_PASSWORD="$SMTP_PASSWORD" \
  -v ~/.config/gcloud:/root/.config/gcloud:ro \
  youtube-backend:local

