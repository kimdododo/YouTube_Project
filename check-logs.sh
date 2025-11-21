#!/bin/bash
# Cloud Run 서비스 로그 확인 스크립트

PROJECT_ID="swift-hangar-477802-t3"
SERVICE_NAME="yt-backend"
REGION="asia-northeast3"

echo "=========================================="
echo "Cloud Run 로그 확인"
echo "=========================================="
echo "프로젝트: $PROJECT_ID"
echo "서비스: $SERVICE_NAME"
echo "리전: $REGION"
echo "=========================================="
echo ""

# 옵션 선택
echo "로그 확인 방법을 선택하세요:"
echo "1. 실시간 로그 스트리밍 (tail -f와 유사)"
echo "2. 최근 로그 100줄 보기"
echo "3. 최근 로그 500줄 보기"
echo "4. 특정 시간대 로그 보기 (최근 1시간)"
echo "5. 에러 로그만 보기"
echo "6. 모든 로그 보기 (최근 1000줄)"
echo ""
read -p "선택 (1-6): " choice

case $choice in
  1)
    echo "실시간 로그 스트리밍 시작 (Ctrl+C로 종료)..."
    echo "최근 로그를 지속적으로 확인합니다..."
    while true; do
      gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=$SERVICE_NAME" \
        --project=$PROJECT_ID \
        --limit=20 \
        --format="table(timestamp,severity,textPayload,jsonPayload.message)" \
        --freshness=1m \
        --order=desc
      echo ""
      echo "--- 5초 후 새 로그 확인 (Ctrl+C로 종료) ---"
      sleep 5
    done
    ;;
  2)
    echo "최근 로그 100줄:"
    gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=$SERVICE_NAME" \
      --project=$PROJECT_ID \
      --limit=100 \
      --format="table(timestamp,severity,textPayload,jsonPayload.message)" \
      --freshness=1h
    ;;
  3)
    echo "최근 로그 500줄:"
    gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=$SERVICE_NAME" \
      --project=$PROJECT_ID \
      --limit=500 \
      --format="table(timestamp,severity,textPayload,jsonPayload.message)" \
      --freshness=1h
    ;;
  4)
    echo "최근 1시간 로그:"
    gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=$SERVICE_NAME" \
      --project=$PROJECT_ID \
      --limit=1000 \
      --format="table(timestamp,severity,textPayload,jsonPayload.message)" \
      --freshness=1h
    ;;
  5)
    echo "에러 로그만 보기:"
    gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=$SERVICE_NAME AND severity>=ERROR" \
      --project=$PROJECT_ID \
      --limit=100 \
      --format="table(timestamp,severity,textPayload,jsonPayload.message)" \
      --freshness=24h
    ;;
  6)
    echo "모든 로그 보기 (최근 1000줄):"
    gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=$SERVICE_NAME" \
      --project=$PROJECT_ID \
      --limit=1000 \
      --format="table(timestamp,severity,textPayload,jsonPayload.message)" \
      --freshness=24h
    ;;
  *)
    echo "잘못된 선택입니다."
    exit 1
    ;;
esac

