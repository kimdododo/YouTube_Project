#!/bin/bash

# 최신 배포 실패 로그 확인
PROJECT_ID="swift-hangar-477802-t3"
SERVICE_NAME="yt-backend"
REGION="asia-northeast3"

echo "=========================================="
echo "최신 배포 로그 확인"
echo "=========================================="

# 최신 리비전 확인
LATEST_REVISION=$(gcloud run revisions list \
  --service=$SERVICE_NAME \
  --region=$REGION \
  --project=$PROJECT_ID \
  --format="value(name)" \
  --limit=1 \
  --sort-by=~metadata.creationTimestamp)

echo "최신 리비전: $LATEST_REVISION"
echo ""

# 에러 로그 확인
echo "=========================================="
echo "❌ 에러 로그"
echo "=========================================="
gcloud logging read \
  "resource.type=cloud_run_revision AND resource.labels.service_name=$SERVICE_NAME AND resource.labels.revision_name=$LATEST_REVISION AND severity>=ERROR" \
  --project=$PROJECT_ID \
  --limit=20 \
  --format="table(timestamp,severity,textPayload)" \
  --order=desc

echo ""
echo "=========================================="
echo "🚀 시작 로그 (시간순)"
echo "=========================================="
gcloud logging read \
  "resource.type=cloud_run_revision AND resource.labels.service_name=$SERVICE_NAME AND resource.labels.revision_name=$LATEST_REVISION AND (textPayload=~\"Backend Startup\" OR textPayload=~\"Starting FastAPI\" OR textPayload=~\"Migration\" OR textPayload=~\"Uvicorn\" OR textPayload=~\"Query\" OR textPayload=~\"NameError\" OR textPayload=~\"ImportError\")" \
  --project=$PROJECT_ID \
  --limit=50 \
  --format="table(timestamp,textPayload)" \
  --order=asc

