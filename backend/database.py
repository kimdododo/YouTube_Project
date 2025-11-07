"""
데이터베이스 연결 유틸리티
Cloud SQL MySQL 연결 관리
"""
import pymysql
from contextlib import contextmanager
from typing import Optional
import os
from dotenv import load_dotenv

load_dotenv()

# DB 연결 정보
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = int(os.getenv("DB_PORT", "3307"))
DB_USER = os.getenv("DB_USER", "")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")
DB_NAME = os.getenv("DB_NAME", "yt")


@contextmanager
def get_db_connection():
    """
    데이터베이스 연결 컨텍스트 매니저
    사용 예시:
        with get_db_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute("SELECT * FROM travel_videos LIMIT 10")
                results = cursor.fetchall()
    """
    conn = None
    try:
        conn = pymysql.connect(
            host=DB_HOST,
            port=DB_PORT,
            user=DB_USER,
            password=DB_PASSWORD,
            database=DB_NAME,
            charset='utf8mb4',
            cursorclass=pymysql.cursors.DictCursor,
            connect_timeout=10,
            read_timeout=30,
            write_timeout=30
        )
        yield conn
    except Exception as e:
        if conn:
            conn.rollback()
        raise e
    finally:
        if conn:
            conn.close()


def test_connection() -> bool:
    """데이터베이스 연결 테스트"""
    try:
        with get_db_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute("SELECT 1 as test")
                result = cursor.fetchone()
                return result is not None
    except Exception:
        return False

