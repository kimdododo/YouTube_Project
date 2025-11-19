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

# DB 연결 정보 (Cloud Run 기준)
DB_HOST = os.getenv("DB_HOST", "").strip()
DB_PORT = int(os.getenv("DB_PORT", "3306").strip())
DB_USER = os.getenv("DB_USER", "").strip()
DB_PASSWORD = os.getenv("DB_PASSWORD", "").strip()
DB_NAME = os.getenv("DB_NAME", "yt").strip()

# Cloud SQL Connector 설정
USE_CLOUD_SQL_CONNECTOR = os.getenv("USE_CLOUD_SQL_CONNECTOR", "false").strip().lower() in ("1", "true", "yes")
CLOUD_SQL_INSTANCE = os.getenv("CLOUD_SQL_INSTANCE", "").strip()

# Cloud SQL Unix 소켓 사용 여부
USE_UNIX_SOCKET = DB_HOST.startswith("/cloudsql/") or (
    DB_HOST.startswith("/") and ":" not in DB_HOST
)

if not USE_CLOUD_SQL_CONNECTOR and not DB_HOST:
    raise ValueError(
        "DB_HOST 환경 변수가 설정되지 않았습니다. Cloud Run에서는 /cloudsql/PROJECT:REGION:INSTANCE "
        "형식이나 Cloud SQL Connector를 사용해야 합니다."
    )


_cloud_sql_connector = None


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
        if USE_CLOUD_SQL_CONNECTOR and CLOUD_SQL_INSTANCE:
            try:
                from google.cloud.sql.connector import Connector, IPTypes  # type: ignore
            except ModuleNotFoundError as import_error:
                raise RuntimeError(
                    "google-cloud-sql-connector 패키지가 설치되지 않았습니다. "
                    "backend/requirements.txt를 확인하세요."
                ) from import_error
            import atexit
            global _cloud_sql_connector

            if _cloud_sql_connector is None:
                _cloud_sql_connector = Connector()
                atexit.register(_cloud_sql_connector.close)

            conn = _cloud_sql_connector.connect(
                CLOUD_SQL_INSTANCE,
                "pymysql",
                user=DB_USER,
                password=DB_PASSWORD,
                db=DB_NAME,
                ip_type=IPTypes.PUBLIC,
            )
        else:
            connect_kwargs = dict(
                user=DB_USER,
                password=DB_PASSWORD,
                database=DB_NAME,
                charset='utf8mb4',
                cursorclass=pymysql.cursors.DictCursor,
                connect_timeout=10,
                read_timeout=30,
                write_timeout=30
            )

            if USE_UNIX_SOCKET:
                connect_kwargs["host"] = "localhost"
                connect_kwargs["unix_socket"] = DB_HOST
            else:
                connect_kwargs["host"] = DB_HOST
                connect_kwargs["port"] = DB_PORT

            conn = pymysql.connect(
                **connect_kwargs
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