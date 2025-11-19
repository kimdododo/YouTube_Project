#!/bin/bash
# Cloud Run 상태 및 로그 확인 스크립트

PROJECT_ID="swift-hangar-477802-t3"
REGION="asia-northeast3"
SERVICE_NAME="yt-backend"

echo "=========================================="
echo "1. Cloud Run 서비스 상태 확인"
echo "=========================================="
gcloud run services describe $SERVICE_NAME \
  --region $REGION \
  --project $PROJECT_ID \
  --format="table(status.conditions.type,status.conditions.status,status.conditions.message)"

echo ""
echo "=========================================="
echo "2. Cloud SQL 인스턴스 연결 확인"
echo "=========================================="
CLOUDSQL_INSTANCES=$(gcloud run services describe $SERVICE_NAME \
  --region $REGION \
  --project $PROJECT_ID \
  --format='value(spec.template.spec.containers[0].cloudsql-instances)')

if [ -z "$CLOUDSQL_INSTANCES" ]; then
  echo "❌ Cloud SQL 인스턴스 연결이 설정되지 않았습니다!"
else
  echo "✅ Cloud SQL 인스턴스 연결: $CLOUDSQL_INSTANCES"
fi

echo ""
echo "=========================================="
echo "3. VPC Connector 연결 확인"
echo "=========================================="
VPC_CONNECTOR=$(gcloud run services describe $SERVICE_NAME \
  --region $REGION \
  --project $PROJECT_ID \
  --format='value(spec.template.spec.containers[0].vpcAccess.connector)')

if [ -z "$VPC_CONNECTOR" ]; then
  echo "⚠️ VPC Connector가 설정되지 않았습니다 (Redis 연결에 필요)"
else
  echo "✅ VPC Connector: $VPC_CONNECTOR"
fi

echo ""
echo "=========================================="
echo "4. 환경 변수 확인 (DB_HOST)"
echo "=========================================="
DB_HOST=$(gcloud run services describe $SERVICE_NAME \
  --region $REGION \
  --project $PROJECT_ID \
  --format='value(spec.template.spec.containers[0].env[?(@.name=="DB_HOST")].value)')

if [ -z "$DB_HOST" ]; then
  echo "❌ DB_HOST 환경 변수가 설정되지 않았습니다!"
else
  echo "✅ DB_HOST: $DB_HOST"
fi

echo ""
echo "=========================================="
echo "5. 서비스 URL 확인"
echo "=========================================="
SERVICE_URL=$(gcloud run services describe $SERVICE_NAME \
  --region $REGION \
  --project $PROJECT_ID \
  --format="value(status.url)")
echo "Service URL: $SERVICE_URL"

echo ""
echo "=========================================="
echo "6. 최근 에러 로그 (최근 20개)"
echo "=========================================="
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=$SERVICE_NAME AND severity>=ERROR" \
  --project $PROJECT_ID \
  --limit 20 \
  --format="table(timestamp,severity,textPayload)" \
  --freshness=1h

echo ""
echo "=========================================="
echo "7. 최근 데이터베이스 관련 로그"
echo "=========================================="
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=$SERVICE_NAME AND (textPayload=~\"Database\" OR textPayload=~\"mysql\" OR textPayload=~\"connection\" OR textPayload=~\"socket\" OR textPayload=~\"DB_HOST\")" \
  --project $PROJECT_ID \
  --limit 20 \
  --format="table(timestamp,severity,textPayload)" \
  --freshness=1h

echo ""
echo "=========================================="
echo "8. API 엔드포인트 테스트"
echo "=========================================="
echo "Testing /api/videos/recommended?limit=5 (10초 타임아웃)..."
curl -s --max-time 10 "$SERVICE_URL/api/videos/recommended?limit=5" -o /tmp/api_test.json
if [ $? -eq 0 ]; then
  echo "✅ API 응답 성공"
  echo "응답 내용 (처음 200자):"
  head -c 200 /tmp/api_test.json
  echo ""
else
  echo "❌ API 응답 실패 또는 타임아웃"
fi

echo ""
echo "=========================================="
echo "✅ 확인 완료!"
echo "=========================================="

