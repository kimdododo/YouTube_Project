#!/bin/bash

# 간단한 Cloud Run 로그 확인 (Cloud Shell용)
PROJECT_ID="swift-hangar-477802-t3"
SERVICE_NAME="yt-backend"
REGION="asia-northeast3"

echo "=========================================="
echo "Cloud Run 로그 확인"
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

# 전체 로그 확인 (간단한 필터)
echo "=========================================="
echo "전체 로그 (최신순)"
echo "=========================================="
gcloud logging read \
  "resource.type=cloud_run_revision AND resource.labels.service_name=$SERVICE_NAME AND resource.labels.revision_name=$LATEST_REVISION" \
  --project=$PROJECT_ID \
  --limit=100 \
  --format="table(timestamp,severity,textPayload)" \
  --order=desc

echo ""
echo "=========================================="
echo "에러 로그만"
echo "=========================================="
gcloud logging read \
  "resource.type=cloud_run_revision AND resource.labels.service_name=$SERVICE_NAME AND resource.labels.revision_name=$LATEST_REVISION AND severity>=ERROR" \
  --project=$PROJECT_ID \
  --limit=50 \
  --format="table(timestamp,severity,textPayload)" \
  --order=desc

