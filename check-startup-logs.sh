#!/bin/bash

# 시작 스크립트 로그만 확인
PROJECT_ID="swift-hangar-477802-t3"
SERVICE_NAME="yt-backend"
REGION="asia-northeast3"

echo "=========================================="
echo "시작 스크립트 로그 확인"
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

# 시작 관련 모든 로그 (시간순)
echo "=========================================="
echo "시작 관련 로그 (시간순)"
echo "=========================================="
gcloud logging read \
  "resource.type=cloud_run_revision AND resource.labels.service_name=$SERVICE_NAME AND resource.labels.revision_name=$LATEST_REVISION AND (textPayload=~\"Backend Startup\" OR textPayload=~\"Starting FastAPI\" OR textPayload=~\"Migration\" OR textPayload=~\"Uvicorn\" OR textPayload=~\"PORT\" OR textPayload=~\"Python\" OR textPayload=~\"Current directory\" OR textPayload=~\"Database\" OR textPayload=~\"Server start\" OR textPayload=~\"exec\")" \
  --project=$PROJECT_ID \
  --limit=200 \
  --format="table(timestamp,textPayload)" \
  --order=asc

echo ""
echo "=========================================="
echo "모든 로그 (INFO 이상, 시간순)"
echo "=========================================="
gcloud logging read \
  "resource.type=cloud_run_revision AND \
   resource.labels.service_name=$SERVICE_NAME AND \
   resource.labels.revision_name=$LATEST_REVISION AND \
   severity>=INFO" \
  --project=$PROJECT_ID \
  --limit=200 \
  --format="table(timestamp,severity,textPayload)" \
  --order=asc

