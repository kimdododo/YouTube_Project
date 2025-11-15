#!/bin/bash

# 대체 방법으로 로그 확인
PROJECT_ID="swift-hangar-477802-t3"
SERVICE_NAME="yt-backend"
REGION="asia-northeast3"

echo "=========================================="
echo "Cloud Run 로그 확인 (대체 방법)"
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

# 방법 1: 리비전 이름 없이 서비스 전체 로그 확인
echo "=========================================="
echo "서비스 전체 최근 로그 (최신순)"
echo "=========================================="
gcloud logging read \
  "resource.type=cloud_run_revision AND resource.labels.service_name=$SERVICE_NAME AND resource.labels.location=$REGION" \
  --project=$PROJECT_ID \
  --limit=50 \
  --format="table(timestamp,severity,resource.labels.revision_name,textPayload)" \
  --order=desc

echo ""
echo "=========================================="
echo "에러만 확인"
echo "=========================================="
gcloud logging read \
  "resource.type=cloud_run_revision AND resource.labels.service_name=$SERVICE_NAME AND resource.labels.location=$REGION AND severity>=ERROR" \
  --project=$PROJECT_ID \
  --limit=30 \
  --format="table(timestamp,severity,resource.labels.revision_name,textPayload)" \
  --order=desc

echo ""
echo "=========================================="
echo "시작 관련 로그"
echo "=========================================="
gcloud logging read \
  "resource.type=cloud_run_revision AND resource.labels.service_name=$SERVICE_NAME AND resource.labels.location=$REGION AND (textPayload=~\"Backend Startup\" OR textPayload=~\"Starting FastAPI\" OR textPayload=~\"Migration\" OR textPayload=~\"Uvicorn\" OR textPayload=~\"PORT\")" \
  --project=$PROJECT_ID \
  --limit=50 \
  --format="table(timestamp,resource.labels.revision_name,textPayload)" \
  --order=desc

