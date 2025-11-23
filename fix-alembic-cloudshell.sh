#!/bin/bash
# Cloud Shell에서 실행할 스크립트

PROJECT_ID="poised-journey-479005-f5"

echo "=========================================="
echo "Alembic Version 수정 스크립트"
echo "=========================================="
echo ""

# DB_PASSWORD 가져오기
echo "1. DB_PASSWORD 가져오는 중..."
export DB_PASSWORD=$(gcloud secrets versions access latest --secret=db-password --project=$PROJECT_ID 2>/dev/null)

if [ -z "$DB_PASSWORD" ]; then
    echo "❌ DB_PASSWORD를 가져올 수 없습니다."
    echo "수동으로 설정하세요:"
    echo "  export DB_PASSWORD='your-password'"
    exit 1
fi

echo "✅ DB_PASSWORD 가져오기 완료"
echo ""

# Python 스크립트 실행
echo "2. Alembic version 테이블 수정 중..."
cd backend
python3 fix_alembic_version.py

echo ""
echo "=========================================="
echo "완료!"
echo "=========================================="

