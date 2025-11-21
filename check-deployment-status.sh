#!/bin/bash
# Cloud Shell에서 실행할 배포 상태 확인 스크립트

PROJECT_ID="swift-hangar-477802-t3"
SERVICE_NAME="yt-backend"
REGION="asia-northeast3"

echo "=========================================="
echo "배포 상태 확인"
echo "=========================================="
echo ""

# 1. 서비스 상태 확인
echo "1. Cloud Run 서비스 상태 확인..."
gcloud run services describe $SERVICE_NAME \
    --region=$REGION \
    --project=$PROJECT_ID \
    --format="table(
        status.conditions[0].type,
        status.conditions[0].status,
        status.url,
        status.latestReadyRevisionName,
        status.latestCreatedRevisionName
    )"

echo ""
echo "=========================================="
echo ""

# 2. 최근 로그 확인
echo "2. 최근 로그 확인 (마지막 50줄)..."
echo "=========================================="
gcloud run services logs read $SERVICE_NAME \
    --region=$REGION \
    --project=$PROJECT_ID \
    --limit=50 \
    --format="table(timestamp,severity,textPayload)"

echo ""
echo "=========================================="
echo ""

# 3. 서비스 URL 확인
echo "3. 서비스 URL:"
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME \
    --region=$REGION \
    --project=$PROJECT_ID \
    --format="value(status.url)")

echo "   $SERVICE_URL"
echo ""
echo "4. 헬스 체크:"
echo "   curl $SERVICE_URL/health"
echo "   또는"
echo "   curl $SERVICE_URL/docs"
echo ""

