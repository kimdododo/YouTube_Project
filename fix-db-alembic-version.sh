#!/bin/bash
# Cloud Shell에서 실행할 스크립트: 데이터베이스의 잘못된 alembic revision 제거

PROJECT_ID="swift-hangar-477802-t3"
INSTANCE_NAME="youtube"
DB_NAME="yt"
DB_USER="yt"

echo "=========================================="
echo "Alembic Version 테이블 수정"
echo "=========================================="
echo ""

# Cloud SQL Proxy를 통해 연결하거나, 직접 SQL 실행
echo "1. Cloud SQL 인스턴스에 연결하여 alembic_version 테이블 확인..."
echo ""

# gcloud sql connect 사용
echo "다음 명령어를 Cloud Shell에서 실행하세요:"
echo ""
echo "gcloud sql connect youtube --user=yt --database=yt --project=swift-hangar-477802-t3"
echo ""
echo "MySQL 프롬프트에서 다음 SQL을 실행:"
echo ""
echo "  SELECT * FROM alembic_version;"
echo "  DELETE FROM alembic_version WHERE version_num = '20250103_01';"
echo "  -- 또는"
echo "  TRUNCATE TABLE alembic_version;  -- 모든 revision 삭제 (처음부터 시작)"
echo ""
echo "=========================================="
echo ""
echo "또는 Python 스크립트로 실행:"
echo "python3 -c \"
from google.cloud.sql.connector import Connector
import pymysql
import os

connector = Connector()
instance_connection_name = 'swift-hangar-477802-t3:asia-northeast3:youtube'

def getconn():
    conn = connector.connect(
        instance_connection_name,
        'pymysql',
        user='yt',
        password=os.getenv('DB_PASSWORD'),
        db='yt',
    )
    return conn

conn = getconn()
cursor = conn.cursor()
cursor.execute('SELECT * FROM alembic_version')
print('Current version:', cursor.fetchone())
cursor.execute('DELETE FROM alembic_version WHERE version_num = \"20250103_01\"')
conn.commit()
print('Deleted invalid revision')
cursor.close()
conn.close()
connector.close()
\""

