#!/bin/bash

# 간단한 Cloud Run 로그 확인
PROJECT_ID="swift-hangar-477802-t3"
SERVICE_NAME="yt-backend"
REGION="asia-northeast3"

echo "=========================================="
echo "Cloud Run 로그 확인"
echo "=========================================="
echo ""

# 1. 최신 리비전 확인
echo "📋 최신 리비전 확인 중..."
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

# 2. 시작 관련 로그 (가장 중요)
echo "=========================================="
echo "🚀 시작 스크립트 로그"
echo "=========================================="
gcloud logging read \
  "resource.type=cloud_run_revision AND \
   resource.labels.service_name=$SERVICE_NAME AND \
   resource.labels.revision_name=$LATEST_REVISION AND \
   (textPayload=~\"Backend Startup\" OR textPayload=~\"Starting FastAPI\" OR textPayload=~\"Migration\" OR textPayload=~\"Uvicorn\" OR textPayload=~\"PORT\" OR textPayload=~\"Python version\")" \
  --project=$PROJECT_ID \
  --limit=50 \
  --format="table(timestamp,textPayload)" \
  --order=asc

echo ""
echo "=========================================="
echo "❌ 에러 로그"
echo "=========================================="
gcloud logging read \
  "resource.type=cloud_run_revision AND \
   resource.labels.service_name=$SERVICE_NAME AND \
   resource.labels.revision_name=$LATEST_REVISION AND \
   severity>=ERROR" \
  --project=$PROJECT_ID \
  --limit=50 \
  --format="table(timestamp,severity,textPayload)" \
  --order=desc

echo ""
echo "=========================================="
echo "⚠️ 경고 및 에러 키워드 포함 로그"
echo "=========================================="
gcloud logging read \
  "resource.type=cloud_run_revision AND \
   resource.labels.service_name=$SERVICE_NAME AND \
   resource.labels.revision_name=$LATEST_REVISION AND \
   (textPayload=~\"error\" OR textPayload=~\"Error\" OR textPayload=~\"ERROR\" OR textPayload=~\"failed\" OR textPayload=~\"Failed\" OR textPayload=~\"FAILED\" OR textPayload=~\"exception\" OR textPayload=~\"Exception\")" \
  --project=$PROJECT_ID \
  --limit=50 \
  --format="table(timestamp,severity,textPayload)" \
  --order=desc

