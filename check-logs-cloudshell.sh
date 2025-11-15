#!/bin/bash

# Google Cloud Shell에서 실행하는 Cloud Run 로그 확인 스크립트

PROJECT_ID="swift-hangar-477802-t3"
SERVICE_NAME="yt-backend"
REGION="asia-northeast3"

echo "=========================================="
echo "Cloud Run 로그 확인"
echo "프로젝트: $PROJECT_ID"
echo "서비스: $SERVICE_NAME"
echo "리전: $REGION"
echo "=========================================="
echo ""

# 최신 리비전 확인
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

# 시작 스크립트 로그 (시간순)
echo "=========================================="
echo "🚀 시작 스크립트 로그 (시간순)"
echo "=========================================="
gcloud logging read \
  "resource.type=cloud_run_revision AND \
   resource.labels.service_name=$SERVICE_NAME AND \
   resource.labels.revision_name=$LATEST_REVISION AND \
   (textPayload=~\"Backend Startup\" OR textPayload=~\"Starting FastAPI\" OR textPayload=~\"Migration\" OR textPayload=~\"Uvicorn\" OR textPayload=~\"PORT\" OR textPayload=~\"Python version\" OR textPayload=~\"Current directory\")" \
  --project=$PROJECT_ID \
  --limit=100 \
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
echo "⚠️ 경고 로그"
echo "=========================================="
gcloud logging read \
  "resource.type=cloud_run_revision AND \
   resource.labels.service_name=$SERVICE_NAME AND \
   resource.labels.revision_name=$LATEST_REVISION AND \
   severity=WARNING" \
  --project=$PROJECT_ID \
  --limit=30 \
  --format="table(timestamp,severity,textPayload)" \
  --order=desc

echo ""
echo "=========================================="
echo "📝 최근 모든 로그 (최신순)"
echo "=========================================="
gcloud logging read \
  "resource.type=cloud_run_revision AND \
   resource.labels.service_name=$SERVICE_NAME AND \
   resource.labels.revision_name=$LATEST_REVISION" \
  --project=$PROJECT_ID \
  --limit=50 \
  --format="table(timestamp,severity,textPayload)" \
  --order=desc

