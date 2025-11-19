#!/bin/bash
# 백엔드 API 테스트 및 로그 확인

PROJECT_ID="swift-hangar-477802-t3"
SERVICE_URL="https://yt-backend-480607763463.asia-northeast3.run.app"

echo "=========================================="
echo "1. API 엔드포인트 직접 테스트"
echo "=========================================="

echo ""
echo "Testing /api/videos/recommended?limit=5..."
echo "----------------------------------------"
time curl -v --max-time 30 "$SERVICE_URL/api/videos/recommended?limit=5" 2>&1 | head -50

echo ""
echo "Testing /api/videos/trends?limit=5..."
echo "----------------------------------------"
time curl -v --max-time 30 "$SERVICE_URL/api/videos/trends?limit=5" 2>&1 | head -50

echo ""
echo "Testing /api/videos/most-liked?limit=5..."
echo "----------------------------------------"
time curl -v --max-time 30 "$SERVICE_URL/api/videos/most-liked?limit=5" 2>&1 | head -50

echo ""
echo "=========================================="
echo "2. 최근 에러 로그 확인"
echo "=========================================="
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=yt-backend AND severity>=ERROR" \
  --project $PROJECT_ID \
  --limit 30 \
  --format="table(timestamp,severity,textPayload)" \
  --freshness=1h

echo ""
echo "=========================================="
echo "3. 데이터베이스 관련 로그"
echo "=========================================="
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=yt-backend AND (textPayload=~\"Database\" OR textPayload=~\"mysql\" OR textPayload=~\"connection\" OR textPayload=~\"socket\" OR textPayload=~\"DB_HOST\" OR textPayload=~\"OperationalError\")" \
  --project $PROJECT_ID \
  --limit 30 \
  --format="table(timestamp,severity,textPayload)" \
  --freshness=1h

echo ""
echo "=========================================="
echo "4. 최근 시작 로그 (서비스 시작 관련)"
echo "=========================================="
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=yt-backend AND (textPayload=~\"Starting\" OR textPayload=~\"startup\" OR textPayload=~\"uvicorn\" OR textPayload=~\"Application startup\")" \
  --project $PROJECT_ID \
  --limit 20 \
  --format="table(timestamp,severity,textPayload)" \
  --freshness=1h

echo ""
echo "✅ 테스트 완료!"

