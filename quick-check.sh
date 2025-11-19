#!/bin/bash
# 빠른 백엔드 상태 확인 스크립트

PROJECT_ID="swift-hangar-477802-t3"
REGION="asia-northeast3"
SERVICE_NAME="yt-backend"

echo "🔍 1. Cloud Run 서비스 상태 확인..."
gcloud run services describe $SERVICE_NAME \
  --region $REGION \
  --project $PROJECT_ID \
  --format="table(status.conditions.type,status.conditions.status,status.conditions.message)"

echo ""
echo "🌐 2. 서비스 URL 확인..."
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME \
  --region $REGION \
  --project $PROJECT_ID \
  --format="value(status.url)")
echo "Service URL: $SERVICE_URL"

echo ""
echo "🔌 3. API 엔드포인트 테스트 (10초 타임아웃)..."
echo "Testing /api/videos/recommended..."
curl -s --max-time 10 "$SERVICE_URL/api/videos/recommended?limit=5" | head -c 200
echo ""

echo ""
echo "📋 4. 최근 에러 로그 (최근 10개)..."
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=$SERVICE_NAME AND severity>=ERROR" \
  --project $PROJECT_ID \
  --limit 10 \
  --format="table(timestamp,severity,textPayload)" \
  --freshness=1h

echo ""
echo "✅ 확인 완료!"

