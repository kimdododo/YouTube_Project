#!/usr/bin/env python3
"""
Alembic version 테이블에서 잘못된 revision 제거 스크립트
데이터베이스에 존재하지 않는 revision (20250103_01)이 기록되어 있을 때 사용
"""
import sys
from app.core.database import engine
from sqlalchemy import text

def fix_alembic_version():
    """alembic_version 테이블에서 잘못된 revision 제거"""
    try:
        with engine.connect() as conn:
            # 현재 revision 확인
            result = conn.execute(text('SELECT version_num FROM alembic_version LIMIT 1'))
            row = result.fetchone()
            
            if row:
                current_version = row[0]
                print(f"[INFO] Current alembic version in DB: {current_version}")
                
                # 잘못된 revision (20250103_01)이 기록되어 있으면 삭제
                if current_version == '20250103_01':
                    print('[WARN] Found invalid revision 20250103_01 in database')
                    print('[INFO] Removing invalid revision from alembic_version table...')
                    conn.execute(text('DELETE FROM alembic_version WHERE version_num = "20250103_01"'))
                    conn.commit()
                    print('[INFO] ✅ Successfully removed invalid revision')
                    return True
                else:
                    print(f'[INFO] Current version {current_version} is valid')
                    return False
            else:
                print('[INFO] No alembic version recorded in database (fresh start)')
                return False
    except Exception as e:
        print(f'[ERROR] Failed to fix alembic_version table: {e}')
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = fix_alembic_version()
    sys.exit(0 if success else 1)

