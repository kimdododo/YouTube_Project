"""
데이터베이스 연결 설정
.env에서 DB 연결 정보를 읽어 SQLAlchemy 엔진을 생성합니다.
"""
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from urllib.parse import quote_plus
from app.core.config import (
    DB_USER,
    DB_PASSWORD,
    DB_HOST,
    DB_PORT,
    DB_NAME,
    USE_CLOUD_SQL_CONNECTOR,
    CLOUD_SQL_INSTANCE,
)

# 환경 변수 검증
if not DB_USER:
    raise ValueError("DB_USER 환경 변수가 설정되지 않았습니다. .env 파일을 확인하세요.")
if not DB_PASSWORD:
    raise ValueError("DB_PASSWORD 환경 변수가 설정되지 않았습니다. .env 파일을 확인하세요.")
if not DB_HOST:
    raise ValueError("DB_HOST 환경 변수가 설정되지 않았습니다. .env 파일을 확인하세요.")

# SQLAlchemy 연결 URL 생성 (특수 문자 URL 인코딩)
# 비밀번호에 특수 문자가 있을 수 있으므로 quote_plus 사용
encoded_password = quote_plus(str(DB_PASSWORD))
encoded_user = quote_plus(str(DB_USER))
encoded_name = quote_plus(str(DB_NAME))
encoded_port = quote_plus(str(DB_PORT or "3306"))
masked_password = "*" * len(str(DB_PASSWORD))

# Cloud SQL Unix 소켓 여부 판단
USE_UNIX_SOCKET = DB_HOST.startswith("/cloudsql/") or (DB_HOST.startswith("/") and ":" not in DB_HOST)

if USE_UNIX_SOCKET:
    DATABASE_URL = f"mysql+pymysql://{encoded_user}:{encoded_password}@/{encoded_name}?charset=utf8mb4"
    connection_hint = f"unix_socket={DB_HOST}"
else:
    DATABASE_URL = (
        f"mysql+pymysql://{encoded_user}:{encoded_password}@"
        f"{DB_HOST}:{encoded_port}/{encoded_name}?charset=utf8mb4"
    )
    connection_hint = f"{DB_HOST}:{DB_PORT or '3306'}"

print(
    "[DEBUG] Database connection: "
    f"mysql+pymysql://{DB_USER}:{masked_password}@{connection_hint}/{DB_NAME}"
)
print(f"[DEBUG] USE_CLOUD_SQL_CONNECTOR: {USE_CLOUD_SQL_CONNECTOR} (type: {type(USE_CLOUD_SQL_CONNECTOR)})")
print(f"[DEBUG] CLOUD_SQL_INSTANCE: {CLOUD_SQL_INSTANCE if CLOUD_SQL_INSTANCE else '(empty)'}")
print(f"[DEBUG] USE_UNIX_SOCKET: {USE_UNIX_SOCKET}")

engine_kwargs = dict(
    pool_pre_ping=True,
    pool_recycle=3600,
    pool_size=10,
    max_overflow=20,
    pool_timeout=30,  # Cloud SQL Connector 사용 시 연결 시간이 더 걸릴 수 있으므로 증가
    echo=False,
)

connector = None

def _init_cloud_sql_connector():
    """Cloud SQL Python Connector 초기화"""
    from google.cloud.sql.connector import Connector
    import atexit

    conn = Connector()
    atexit.register(conn.close)
    return conn


def _cloud_sql_creator():
    """Cloud SQL Python Connector로 MySQL 연결 생성"""
    from google.cloud.sql.connector import IPTypes

    if not CLOUD_SQL_INSTANCE:
        raise ValueError("CLOUD_SQL_INSTANCE 환경 변수가 필요합니다.")
    
    # PRIVATE IP 사용 (VPC 내부 연결 - 더 빠르고 안정적)
    print(f"[DEBUG] Connecting to Cloud SQL instance: {CLOUD_SQL_INSTANCE} using PRIVATE IP")
    return connector.connect(
        CLOUD_SQL_INSTANCE,
        "pymysql",
        user=DB_USER,
        password=DB_PASSWORD,
        db=DB_NAME,
        ip_type=IPTypes.PRIVATE,  # VPC 내부 연결 사용 (Cloud Run에서 권장)
    )

# Cloud SQL Connector가 최우선순위 (USE_CLOUD_SQL_CONNECTOR가 True이고 CLOUD_SQL_INSTANCE가 설정되어 있으면 무조건 사용)
# 이 경우 DB_HOST는 무시됨
if USE_CLOUD_SQL_CONNECTOR:
    if not CLOUD_SQL_INSTANCE:
        raise ValueError(
            "USE_CLOUD_SQL_CONNECTOR가 true로 설정되었지만 CLOUD_SQL_INSTANCE 환경 변수가 설정되지 않았습니다. "
            f"현재 값: '{CLOUD_SQL_INSTANCE}'"
        )
    print("[DEBUG] Using Cloud SQL Python Connector for database connections")
    print(f"[DEBUG] CLOUD_SQL_INSTANCE: {CLOUD_SQL_INSTANCE}")
    print("[DEBUG] DB_HOST는 무시됩니다 (Cloud SQL Connector 사용)")
    connector = _init_cloud_sql_connector()
    engine = create_engine(
        "mysql+pymysql://",
        creator=_cloud_sql_creator,
        **engine_kwargs,
    )
elif USE_UNIX_SOCKET:
    import os
    import pymysql

    socket_exists = os.path.exists(DB_HOST)
    print(f"[DEBUG] Unix socket exists: {socket_exists}")

    if not socket_exists:
        print(f"[WARNING] Unix socket file not found at {DB_HOST}")
        socket_dir = os.path.dirname(DB_HOST)
        if os.path.exists(socket_dir):
            try:
                print(f"[DEBUG] Socket directory exists: {socket_dir}")
                print(f"[DEBUG] Files in socket directory: {os.listdir(socket_dir)}")
            except Exception as e:
                print(f"[DEBUG] Cannot list socket directory: {e}")
        else:
            print(f"[WARNING] Socket directory does not exist: {socket_dir}")

    def create_unix_socket_connection():
        """Unix socket을 사용하여 Cloud SQL에 연결하는 커스텀 creator 함수"""
        return pymysql.connect(
            host=None,  # Unix socket 사용 시 host는 None이어야 함
            unix_socket=DB_HOST,
            user=DB_USER,
            password=DB_PASSWORD,
            database=DB_NAME,
            charset="utf8mb4",
            sql_mode="TRADITIONAL",
            connect_timeout=5,
            read_timeout=30,
            write_timeout=30,
        )

    engine = create_engine(
        DATABASE_URL,
        creator=create_unix_socket_connection,
        **engine_kwargs,
    )
else:
    engine = create_engine(DATABASE_URL, **engine_kwargs)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """
    데이터베이스 세션 의존성
    FastAPI의 Depends에서 사용합니다.
    pool_pre_ping=True로 설정되어 있어 연결 상태를 자동으로 확인합니다.
    """
    db = None
    try:
        db = SessionLocal()
        yield db
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"[Database] Connection failed: {str(e)}")
        # 세션이 생성되었으면 닫기
        if db:
            try:
                db.close()
            except:
                pass
        # 에러를 다시 발생시켜서 API가 빈 응답을 반환하도록 함
        raise
    finally:
        if db:
            try:
                db.close()
            except:
                pass

