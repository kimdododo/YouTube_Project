#!/bin/bash
# Cloud Shell에서 실행할 간단한 스크립트

PROJECT_ID="poised-journey-479005-f5"

echo "=========================================="
echo "Alembic Version 수정 (간단 버전)"
echo "=========================================="
echo ""

# 방법 1: gcloud sql connect 사용 (가장 간단)
echo "방법 1: gcloud sql connect 사용"
echo ""
echo "다음 명령어를 실행하세요:"
echo "  gcloud sql connect youtube --user=yt --project=$PROJECT_ID"
echo ""
echo "MySQL 프롬프트에서 다음 SQL을 실행:"
echo "  USE yt;"
echo "  SELECT * FROM alembic_version;"
echo "  DELETE FROM alembic_version WHERE version_num = '20250103_01';"
echo "  exit;"
echo ""
echo "=========================================="
echo ""

# 방법 2: Python 패키지 설치 후 실행
echo "방법 2: Python 패키지 설치 후 실행"
echo ""
echo "다음 명령어를 실행하세요:"
echo "  pip3 install cloud-sql-python-connector[pymysql] --user"
echo "  export DB_PASSWORD=\$(gcloud secrets versions access latest --secret=db-password --project=$PROJECT_ID)"
echo "  python3 fix_alembic_version.py"
echo ""

