#!/bin/bash
# API 상태 및 로그 확인 스크립트

PROJECT_ID="swift-hangar-477802-t3"
REGION="asia-northeast3"
SERVICE_NAME="yt-backend"
SERVICE_URL="https://yt-backend-480607763463.asia-northeast3.run.app"

echo "=========================================="
echo "1. Cloud Run 서비스 최신 리비전 확인"
echo "=========================================="
LATEST_REVISION=$(gcloud run services describe $SERVICE_NAME \
  --region $REGION \
  --project $PROJECT_ID \
  --format='value(status.latestReadyRevisionName)')
echo "Latest Revision: $LATEST_REVISION"

LATEST_READY_TIME=$(gcloud run services describe $SERVICE_NAME \
  --region $REGION \
  --project $PROJECT_ID \
  --format='value(status.latestReadyRevisionName)' | xargs -I {} gcloud run revisions describe {} \
  --region $REGION \
  --project $PROJECT_ID \
  --format='value(metadata.creationTimestamp)' 2>/dev/null || echo "N/A")
echo "Latest Ready Time: $LATEST_READY_TIME"

echo ""
echo "=========================================="
echo "2. 서비스 상태 확인"
echo "=========================================="
gcloud run services describe $SERVICE_NAME \
  --region $REGION \
  --project $PROJECT_ID \
  --format="table(status.conditions.type,status.conditions.status,status.conditions.message)"

echo ""
echo "=========================================="
echo "3. 최근 에러 로그 (최근 30개)"
echo "=========================================="
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=$SERVICE_NAME AND severity>=ERROR" \
  --project $PROJECT_ID \
  --limit 30 \
  --format="table(timestamp,severity,textPayload)" \
  --freshness=30m

echo ""
echo "=========================================="
echo "4. 데이터베이스 연결 관련 로그"
echo "=========================================="
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=$SERVICE_NAME AND (textPayload=~\"Database\" OR textPayload=~\"mysql\" OR textPayload=~\"connection\" OR textPayload=~\"socket\" OR textPayload=~\"OperationalError\" OR textPayload=~\"unix_socket\")" \
  --project $PROJECT_ID \
  --limit 30 \
  --format="table(timestamp,severity,textPayload)" \
  --freshness=30m

echo ""
echo "=========================================="
echo "5. 서비스 시작 로그"
echo "=========================================="
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=$SERVICE_NAME AND (textPayload=~\"Starting\" OR textPayload=~\"startup\" OR textPayload=~\"uvicorn\" OR textPayload=~\"Application startup\" OR textPayload=~\"DEBUG\")" \
  --project $PROJECT_ID \
  --limit 20 \
  --format="table(timestamp,severity,textPayload)" \
  --freshness=30m

echo ""
echo "=========================================="
echo "6. API 엔드포인트 테스트 (타임아웃 10초)"
echo "=========================================="
echo "Testing: $SERVICE_URL/api/videos/recommended?limit=5"
timeout 10 curl -v "$SERVICE_URL/api/videos/recommended?limit=5" 2>&1 | head -30

echo ""
echo "=========================================="
echo "✅ 확인 완료!"
echo "=========================================="

