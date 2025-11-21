#!/bin/bash
# Python 구문 오류 확인 스크립트

PROJECT_ID="swift-hangar-477802-t3"
SERVICE_NAME="yt-backend"
REGION="asia-northeast3"

echo "=========================================="
echo "Python 구문 오류 확인"
echo "=========================================="

# 최근 에러 로그에서 SyntaxError 찾기
echo "최근 SyntaxError 로그 확인:"
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=$SERVICE_NAME AND (textPayload=~\"SyntaxError\" OR textPayload=~\"unmatched\" OR textPayload=~\"IndentationError\")" \
  --project=$PROJECT_ID \
  --limit=50 \
  --format="table(timestamp,severity,textPayload)" \
  --freshness=24h

echo ""
echo "=========================================="
echo "최근 모든 에러 로그:"
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=$SERVICE_NAME AND severity>=ERROR" \
  --project=$PROJECT_ID \
  --limit=20 \
  --format="table(timestamp,severity,textPayload)" \
  --freshness=1h

