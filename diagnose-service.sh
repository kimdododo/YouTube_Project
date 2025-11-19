#!/bin/bash
# 서비스 진단 스크립트

PROJECT_ID="swift-hangar-477802-t3"
REGION="asia-northeast3"
SERVICE_NAME="yt-backend"
SERVICE_URL="https://yt-backend-480607763463.asia-northeast3.run.app"

echo "=========================================="
echo "1. 서비스 상태 확인"
echo "=========================================="
gcloud run services describe $SERVICE_NAME \
  --region $REGION \
  --project $PROJECT_ID \
  --format="table(status.conditions.type,status.conditions.status,status.conditions.message,status.conditions.reason)"

echo ""
echo "=========================================="
echo "2. 최신 리비전 상태"
echo "=========================================="
LATEST_REVISION=$(gcloud run services describe $SERVICE_NAME \
  --region $REGION \
  --project $PROJECT_ID \
  --format='value(status.latestReadyRevisionName)')
echo "Latest Revision: $LATEST_REVISION"

if [ -n "$LATEST_REVISION" ]; then
  echo ""
  echo "리비전 상세 정보:"
  gcloud run revisions describe $LATEST_REVISION \
    --region $REGION \
    --project $PROJECT_ID \
    --format="table(status.conditions.type,status.conditions.status,status.conditions.message)"
fi

echo ""
echo "=========================================="
echo "3. 서비스 시작 실패 로그 (최근 50개)"
echo "=========================================="
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=$SERVICE_NAME AND (severity>=ERROR OR textPayload=~\"Traceback\" OR textPayload=~\"Exception\" OR textPayload=~\"Error\")" \
  --project $PROJECT_ID \
  --limit 50 \
  --format="table(timestamp,severity,textPayload)" \
  --freshness=1h

echo ""
echo "=========================================="
echo "4. 애플리케이션 시작 로그"
echo "=========================================="
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=$SERVICE_NAME AND (textPayload=~\"Starting\" OR textPayload=~\"uvicorn\" OR textPayload=~\"Application startup\" OR textPayload=~\"FastAPI\" OR textPayload=~\"Startup\")" \
  --project $PROJECT_ID \
  --limit 30 \
  --format="table(timestamp,severity,textPayload)" \
  --freshness=1h

echo ""
echo "=========================================="
echo "5. 데이터베이스 연결 로그"
echo "=========================================="
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=$SERVICE_NAME AND (textPayload=~\"Database\" OR textPayload=~\"mysql\" OR textPayload=~\"connection\" OR textPayload=~\"socket\" OR textPayload=~\"unix_socket\" OR textPayload=~\"OperationalError\" OR textPayload=~\"ValueError\" OR textPayload=~\"DEBUG\")" \
  --project $PROJECT_ID \
  --limit 50 \
  --format="table(timestamp,severity,textPayload)" \
  --freshness=1h

echo ""
echo "=========================================="
echo "6. 루트 엔드포인트 테스트"
echo "=========================================="
echo "Testing: $SERVICE_URL/"
echo "----------------------------------------"
curl -v --max-time 10 "$SERVICE_URL/" 2>&1 | head -30

echo ""
echo "=========================================="
echo "7. 헬스체크 엔드포인트 테스트"
echo "=========================================="
echo "Testing: $SERVICE_URL/ping"
echo "----------------------------------------"
curl -v --max-time 10 "$SERVICE_URL/ping" 2>&1 | head -30

echo ""
echo "=========================================="
echo "✅ 진단 완료!"
echo "=========================================="

