#!/usr/bin/env python3
"""
Cloud Shell에서 실행할 Alembic version 수정 스크립트
데이터베이스의 잘못된 revision (20250103_01) 제거
"""
import os
from google.cloud.sql.connector import Connector
import pymysql

# 환경 변수에서 비밀번호 가져오기 (Secret Manager 또는 환경 변수)
DB_PASSWORD = os.getenv('DB_PASSWORD')
if not DB_PASSWORD:
    print("❌ DB_PASSWORD 환경 변수가 설정되지 않았습니다.")
    print("다음 명령어로 설정하세요:")
    print("  export DB_PASSWORD=$(gcloud secrets versions access latest --secret=db-password --project=swift-hangar-477802-t3)")
    exit(1)

INSTANCE_CONNECTION_NAME = 'swift-hangar-477802-t3:asia-northeast3:youtube'
DB_USER = 'yt'
DB_NAME = 'yt'

print("==========================================")
print("Alembic Version 테이블 수정")
print("==========================================")
print(f"Instance: {INSTANCE_CONNECTION_NAME}")
print(f"Database: {DB_NAME}")
print(f"User: {DB_USER}")
print("==========================================")
print("")

connector = Connector()

def getconn():
    """Cloud SQL 연결 생성"""
    conn = connector.connect(
        INSTANCE_CONNECTION_NAME,
        'pymysql',
        user=DB_USER,
        password=DB_PASSWORD,
        db=DB_NAME,
    )
    return conn

try:
    conn = getconn()
    cursor = conn.cursor()
    
    # 현재 revision 확인
    print("1. 현재 alembic_version 확인 중...")
    cursor.execute('SELECT version_num FROM alembic_version LIMIT 1')
    result = cursor.fetchone()
    
    if result:
        current_version = result[0]
        print(f"   현재 revision: {current_version}")
        
        if current_version == '20250103_01':
            print("2. 잘못된 revision (20250103_01) 발견!")
            print("3. 잘못된 revision 삭제 중...")
            cursor.execute('DELETE FROM alembic_version WHERE version_num = "20250103_01"')
            conn.commit()
            print("   ✅ 잘못된 revision 삭제 완료")
            
            # 삭제 후 확인
            cursor.execute('SELECT version_num FROM alembic_version LIMIT 1')
            result_after = cursor.fetchone()
            if result_after:
                print(f"   현재 revision: {result_after[0]}")
            else:
                print("   alembic_version 테이블이 비어있습니다 (새로 시작 가능)")
        else:
            print(f"   ✅ 현재 revision ({current_version})은 유효합니다")
    else:
        print("   alembic_version 테이블이 비어있습니다 (새로 시작 가능)")
    
    cursor.close()
    conn.close()
    print("")
    print("==========================================")
    print("✅ 완료!")
    print("==========================================")
    
except Exception as e:
    print(f"❌ 오류 발생: {e}")
    import traceback
    traceback.print_exc()
    exit(1)
finally:
    connector.close()

