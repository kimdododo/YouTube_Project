#!/bin/bash
# Cloud Run 로그 빠른 확인 스크립트

PROJECT_ID="swift-hangar-477802-t3"
SERVICE_NAME="yt-backend"
REGION="asia-northeast3"

echo "=========================================="
echo "Cloud Run 로그 확인 (yt-backend)"
echo "=========================================="
echo ""

# 실시간 로그 확인 (5초마다 갱신)
echo "실시간 로그 확인 중... (Ctrl+C로 종료)"
echo ""

while true; do
  clear
  echo "=========================================="
  echo "최근 로그 (최근 1분, 최대 30줄)"
  echo "시간: $(date '+%Y-%m-%d %H:%M:%S')"
  echo "=========================================="
  gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=$SERVICE_NAME" \
    --project=$PROJECT_ID \
    --limit=30 \
    --format="table(timestamp,severity,textPayload,jsonPayload.message)" \
    --freshness=1m \
    --order=desc 2>/dev/null | head -40
  
  echo ""
  echo "=========================================="
  echo "5초 후 새 로그 확인... (Ctrl+C로 종료)"
  sleep 5
done

