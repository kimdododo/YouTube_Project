#!/bin/bash

# Cloud Run 로그 확인 스크립트
# 사용법: ./check-cloud-run-logs.sh

PROJECT_ID="swift-hangar-477802-t3"
SERVICE_NAME="yt-backend"
REGION="asia-northeast3"

echo "=========================================="
echo "Cloud Run 로그 확인"
echo "=========================================="
echo "프로젝트: $PROJECT_ID"
echo "서비스: $SERVICE_NAME"
echo "리전: $REGION"
echo ""

# 최신 리비전 확인
echo "최신 리비전 확인 중..."
LATEST_REVISION=$(gcloud run revisions list \
  --service=$SERVICE_NAME \
  --region=$REGION \
  --project=$PROJECT_ID \
  --format="value(name)" \
  --limit=1 \
  --sort-by=~metadata.creationTimestamp)

if [ -z "$LATEST_REVISION" ]; then
  echo "❌ 리비전을 찾을 수 없습니다."
  exit 1
fi

echo "✅ 최신 리비전: $LATEST_REVISION"
echo ""

# 최근 로그 확인 (최근 100줄)
echo "=========================================="
echo "최근 로그 (최근 100줄)"
echo "=========================================="
gcloud logging read \
  "resource.type=cloud_run_revision AND \
   resource.labels.service_name=$SERVICE_NAME AND \
   resource.labels.revision_name=$LATEST_REVISION" \
  --project=$PROJECT_ID \
  --limit=100 \
  --format="table(timestamp,severity,textPayload,jsonPayload.message)" \
  --order=desc

echo ""
echo "=========================================="
echo "에러 로그만 필터링"
echo "=========================================="
gcloud logging read \
  "resource.type=cloud_run_revision AND \
   resource.labels.service_name=$SERVICE_NAME AND \
   resource.labels.location=$REGION AND \
   resource.labels.revision_name=$LATEST_REVISION AND \
   (severity>=ERROR OR textPayload=~\"error\" OR textPayload=~\"Error\" OR textPayload=~\"ERROR\" OR textPayload=~\"failed\" OR textPayload=~\"Failed\" OR textPayload=~\"FAILED\")" \
  --project=$PROJECT_ID \
  --limit=50 \
  --format="table(timestamp,severity,textPayload,jsonPayload.message)" \
  --order=desc

echo ""
echo "=========================================="
echo "시작 스크립트 로그"
echo "=========================================="
gcloud logging read \
  "resource.type=cloud_run_revision AND \
   resource.labels.service_name=$SERVICE_NAME AND \
   resource.labels.location=$REGION AND \
   resource.labels.revision_name=$LATEST_REVISION AND \
   (textPayload=~\"Backend Startup\" OR textPayload=~\"Starting FastAPI\" OR textPayload=~\"Migration\" OR textPayload=~\"Uvicorn\")" \
  --project=$PROJECT_ID \
  --limit=50 \
  --format="table(timestamp,severity,textPayload)" \
  --order=desc

echo ""
echo "=========================================="
echo "전체 로그를 파일로 저장하려면:"
echo "gcloud logging read \\"
echo "  \"resource.type=cloud_run_revision AND resource.labels.service_name=$SERVICE_NAME AND resource.labels.revision_name=$LATEST_REVISION\" \\"
echo "  --project=$PROJECT_ID \\"
echo "  --limit=1000 \\"
echo "  --format=json > cloud-run-logs.json"
echo "=========================================="

