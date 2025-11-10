#!/bin/bash
# Cloud Run 서비스 설정 확인 스크립트
# Cloud Shell에서 실행

REGION="asia-northeast3"
SERVICE_NAME="yt-backend"

echo "=========================================="
echo "Cloud Run 서비스 설정 확인"
echo "=========================================="
echo ""

echo "📋 서비스 기본 정보"
echo "----------------------------------------"
gcloud run services describe $SERVICE_NAME --region=$REGION --format="value(metadata.name, status.url)"
echo ""

echo "💾 리소스 설정"
echo "----------------------------------------"
gcloud run services describe $SERVICE_NAME --region=$REGION --format="table(
  spec.template.spec.containers[0].resources.limits.memory,
  spec.template.spec.containers[0].resources.limits.cpu,
  spec.template.spec.timeoutSeconds
)"
echo ""

echo "📊 인스턴스 스케일링 설정"
echo "----------------------------------------"
MAX_SCALE=$(gcloud run services describe $SERVICE_NAME --region=$REGION --format="value(spec.template.metadata.annotations.'autoscaling.knative.dev/maxScale')")
MIN_SCALE=$(gcloud run services describe $SERVICE_NAME --region=$REGION --format="value(spec.template.metadata.annotations.'autoscaling.knative.dev/minScale')")
echo "최대 인스턴스: ${MAX_SCALE:-'설정 안됨'}"
echo "최소 인스턴스: ${MIN_SCALE:-'설정 안됨'}"
echo ""

echo "🔧 환경 변수 목록"
echo "----------------------------------------"
ENV_VARS=$(gcloud run services describe $SERVICE_NAME --region=$REGION --format="value(spec.template.spec.containers[0].env[].name)" | sort)
if [ -z "$ENV_VARS" ]; then
  echo "환경 변수가 없습니다."
else
  echo "$ENV_VARS"
fi
echo ""

echo "🔐 Secrets 목록"
echo "----------------------------------------"
SECRETS=$(gcloud run services describe $SERVICE_NAME --region=$REGION --format="value(spec.template.spec.containers[0].env[].valueSource.secretKeyRef.name)" | grep -v "^$" | sort -u)
if [ -z "$SECRETS" ]; then
  echo "Secrets가 없습니다."
else
  echo "$SECRETS"
fi
echo ""

echo "📄 전체 YAML 저장 중..."
gcloud run services describe $SERVICE_NAME --region=$REGION --format=yaml > service-config.yaml
echo "✅ 저장 완료: service-config.yaml"
echo ""

echo "=========================================="
echo "요약 정보"
echo "=========================================="
MEMORY=$(gcloud run services describe $SERVICE_NAME --region=$REGION --format="value(spec.template.spec.containers[0].resources.limits.memory)")
CPU=$(gcloud run services describe $SERVICE_NAME --region=$REGION --format="value(spec.template.spec.containers[0].resources.limits.cpu)")
TIMEOUT=$(gcloud run services describe $SERVICE_NAME --region=$REGION --format="value(spec.template.spec.timeoutSeconds)")

echo "메모리: $MEMORY"
echo "CPU: $CPU"
echo "타임아웃: ${TIMEOUT}초"
echo "최대 인스턴스: ${MAX_SCALE:-'설정 안됨'}"
echo "최소 인스턴스: ${MIN_SCALE:-'설정 안됨'}"
echo ""

