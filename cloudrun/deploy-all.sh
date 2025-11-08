#!/bin/bash
# 전체 배포 스크립트 (백엔드 + 프런트엔드)

PROJECT_ID="eastern-gravity-473301-n8"
REGION="asia-northeast3"
BACKEND_SERVICE="yt-backend"
FRONTEND_SERVICE="yt-frontend"
INSTANCE="eastern-gravity-473301-n8:us-central1:kimdohyun"

echo "=========================================="
echo "전체 배포 시작"
echo "=========================================="
echo ""

# 백엔드 배포
echo "1. 백엔드 배포 중..."
gcloud run deploy ${BACKEND_SERVICE} \
  --image docker.io/kimdododo/youtube-backend:v8 \
  --region ${REGION} \
  --platform managed \
  --allow-unauthenticated \
  --port 8080 \
  --memory 2Gi \
  --cpu 2 \
  --timeout 300 \
  --min-instances 0 \
  --max-instances 10 \
  --set-env-vars DB_NAME=yt,DB_USER=ytuser,DB_PORT=3306,DB_HOST=/cloudsql/${INSTANCE},JWT_ALGO=HS256,JWT_ACCESS_MINUTES=60 \
  --set-secrets DB_PASSWORD=db-password:latest,JWT_SECRET=jwt-secret:latest \
  --add-cloudsql-instances ${INSTANCE} \
  --service-account yt-backend@${PROJECT_ID}.iam.gserviceaccount.com

BACKEND_URL=$(gcloud run services describe ${BACKEND_SERVICE} --region ${REGION} --format 'value(status.url)')
echo "백엔드 URL: ${BACKEND_URL}"
echo ""

# 프런트엔드 배포
echo "2. 프런트엔드 배포 중..."
gcloud run deploy ${FRONTEND_SERVICE} \
  --image docker.io/kimdododo/youtube-frontend:v4 \
  --region ${REGION} \
  --platform managed \
  --allow-unauthenticated \
  --port 80 \
  --memory 512Mi \
  --cpu 1 \
  --timeout 300

FRONTEND_URL=$(gcloud run services describe ${FRONTEND_SERVICE} --region ${REGION} --format 'value(status.url)')
echo "프런트엔드 URL: ${FRONTEND_URL}"
echo ""

echo "=========================================="
echo "배포 완료!"
echo "=========================================="
echo "백엔드: ${BACKEND_URL}"
echo "프런트엔드: ${FRONTEND_URL}"

