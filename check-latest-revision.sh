#!/bin/bash

# 최신 리비전 로그 확인
PROJECT_ID="swift-hangar-477802-t3"
SERVICE_NAME="yt-backend"
REGION="asia-northeast3"

echo "=========================================="
echo "최신 리비전 로그 확인"
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

# 최신 리비전의 전체 로그 (시간순)
echo "=========================================="
echo "최신 리비전 전체 로그 (시간순)"
echo "=========================================="
gcloud logging read \
  "resource.type=cloud_run_revision AND resource.labels.service_name=$SERVICE_NAME AND resource.labels.revision_name=$LATEST_REVISION" \
  --project=$PROJECT_ID \
  --limit=200 \
  --format="table(timestamp,severity,textPayload)" \
  --order=asc

echo ""
echo "=========================================="
echo "에러 로그만"
echo "=========================================="
gcloud logging read \
  "resource.type=cloud_run_revision AND resource.labels.service_name=$SERVICE_NAME AND resource.labels.revision_name=$LATEST_REVISION AND severity>=ERROR" \
  --project=$PROJECT_ID \
  --limit=30 \
  --format="table(timestamp,severity,textPayload)" \
  --order=desc

