#!/bin/bash
# Cloud Memorystore for Redis 설정 스크립트
# 필요한 API 활성화 및 인스턴스 생성

PROJECT_ID="swift-hangar-477802-t3"
REGION="asia-northeast3"

echo "🔧 Enabling required APIs for Memorystore..."

# Memorystore API 활성화
gcloud services enable redis.googleapis.com --project=$PROJECT_ID

# VPC Access API 활성화 (VPC Connector용)
gcloud services enable vpcaccess.googleapis.com --project=$PROJECT_ID

# Compute Engine API 활성화 (VPC Connector용)
gcloud services enable compute.googleapis.com --project=$PROJECT_ID

# Service Networking API 활성화 (VPC 피어링용)
gcloud services enable servicenetworking.googleapis.com --project=$PROJECT_ID

# Cloud Resource Manager API 활성화
gcloud services enable cloudresourcemanager.googleapis.com --project=$PROJECT_ID

echo "✅ APIs enabled"
echo ""
echo "⏳ Waiting for APIs to propagate (30 seconds)..."
sleep 30

echo ""
echo "🔍 Checking if default VPC network exists..."
if gcloud compute networks describe default --project=$PROJECT_ID &>/dev/null; then
    echo "✅ Default network exists"
else
    echo "⚠️ Default network not found, creating..."
    gcloud compute networks create default --project=$PROJECT_ID
fi

echo ""
echo "🔍 Checking if subnet exists in $REGION..."
SUBNET_NAME="default"
if gcloud compute networks subnets describe $SUBNET_NAME --region=$REGION --project=$PROJECT_ID &>/dev/null; then
    echo "✅ Subnet exists"
else
    echo "⚠️ Subnet not found, creating..."
    gcloud compute networks subnets create $SUBNET_NAME \
        --network=default \
        --range=10.0.0.0/24 \
        --region=$REGION \
        --project=$PROJECT_ID
fi

echo ""
echo "🔧 Creating VPC Connector..."
gcloud compute networks vpc-access connectors create redis-connector \
    --region=$REGION \
    --subnet=$SUBNET_NAME \
    --subnet-project=$PROJECT_ID \
    --min-instances=2 \
    --max-instances=3 \
    --machine-type=e2-micro \
    --project=$PROJECT_ID

echo ""
echo "⏳ Waiting for VPC Connector to be ready (60 seconds)..."
sleep 60

echo ""
echo "🔧 Creating Redis instance..."
gcloud redis instances create redis-cache \
    --size=1 \
    --region=$REGION \
    --network=projects/$PROJECT_ID/global/networks/default \
    --redis-version=redis_7_2 \
    --project=$PROJECT_ID

echo ""
echo "✅ Setup complete!"
echo ""
echo "📋 Getting Redis IP address..."
REDIS_IP=$(gcloud redis instances describe redis-cache \
    --region=$REGION \
    --format="value(host)" \
    --project=$PROJECT_ID)

echo "Redis IP: $REDIS_IP"
echo "REDIS_URL: redis://$REDIS_IP:6379/0"
echo ""
echo "⚠️ Add this to GitHub Secrets:"
echo "   Name: REDIS_URL"
echo "   Value: redis://$REDIS_IP:6379/0"

