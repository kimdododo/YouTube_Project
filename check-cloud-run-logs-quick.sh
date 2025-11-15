#!/bin/bash

# 빠른 로그 확인 (최근 에러만)
PROJECT_ID="swift-hangar-477802-t3"
SERVICE_NAME="yt-backend"
REGION="asia-northeast3"

echo "🔍 Cloud Run 로그 확인 중..."
echo ""

# 최신 리비전의 에러 로그만 확인 (--region 옵션 제거)
gcloud logging read \
  "resource.type=cloud_run_revision AND \
   resource.labels.service_name=$SERVICE_NAME AND \
   resource.labels.location=$REGION AND \
   (severity>=ERROR OR textPayload=~\"error\" OR textPayload=~\"Error\" OR textPayload=~\"failed\" OR textPayload=~\"Failed\" OR textPayload=~\"Migration\" OR textPayload=~\"Starting FastAPI\" OR textPayload=~\"Uvicorn\")" \
  --project=$PROJECT_ID \
  --limit=100 \
  --format="table(timestamp,severity,textPayload)" \
  --order=desc

