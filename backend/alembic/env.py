from __future__ import with_statement
from logging.config import fileConfig
from sqlalchemy import create_engine
from alembic import context
from urllib.parse import quote_plus

# Alembic config
config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# 모델 메타데이터만 가져온다
from app.core.database import Base  # 여기서는 engine 안 가져옴
# 모든 모델을 임포트하여 Base.metadata에 등록
from app.models import (
    user,
    video,
    channel,
    login_history,
    user_travel_preference,
    email_verification,
    comment_sentiment,  # 댓글 감정 요약 캐시 테이블
)  # noqa: ensure models are imported

from app.core.config import (
    DB_USER, DB_PASSWORD, DB_HOST, DB_PORT, DB_NAME,
    USE_CLOUD_SQL_CONNECTOR, CLOUD_SQL_INSTANCE
)

target_metadata = Base.metadata

# 디버그: 환경 변수 확인
print(f"[Alembic] DEBUG - USE_CLOUD_SQL_CONNECTOR: {USE_CLOUD_SQL_CONNECTOR} (type: {type(USE_CLOUD_SQL_CONNECTOR)})")
print(f"[Alembic] DEBUG - CLOUD_SQL_INSTANCE: '{CLOUD_SQL_INSTANCE if CLOUD_SQL_INSTANCE else '(empty)'}'")
print(f"[Alembic] DEBUG - DB_HOST: '{DB_HOST if DB_HOST else '(empty)'}'")


def get_database_url() -> str:
    """데이터베이스 연결 URL 생성 (Unix 소켓 및 TCP 지원)"""
    encoded_user = quote_plus(str(DB_USER))
    encoded_password = quote_plus(str(DB_PASSWORD))
    db_host = (DB_HOST or "").strip()
    db_port = str(DB_PORT).strip() if DB_PORT else "3306"
    db_name = str(DB_NAME or "yt").strip()

    # Cloud SQL Python Connector 사용 시 URL만 반환 (실제 연결은 creator에서 처리)
    if USE_CLOUD_SQL_CONNECTOR and CLOUD_SQL_INSTANCE:
        print(f"[Alembic] Using Cloud SQL Python Connector: {CLOUD_SQL_INSTANCE}")
        return "mysql+pymysql://"  # 빈 URL, creator에서 실제 연결 처리
    
    print(f"[Alembic] NOT using Cloud SQL Connector (USE_CLOUD_SQL_CONNECTOR={USE_CLOUD_SQL_CONNECTOR}, CLOUD_SQL_INSTANCE={bool(CLOUD_SQL_INSTANCE)})")

    if not db_host:
        raise ValueError(
            "DB_HOST 환경 변수가 설정되지 않았습니다. Cloud SQL Unix socket 경로(/cloudsql/...)를 설정하세요."
        )

    # Cloud SQL unix socket인 경우
    if db_host.startswith("/cloudsql/") or (db_host.startswith("/") and ":" not in db_host):
        return (
            f"mysql+pymysql://{encoded_user}:{encoded_password}@/{db_name}"
            f"?unix_socket={quote_plus(db_host)}&charset=utf8mb4"
        )

    # 일반 TCP 연결 (로컬 개발 등)
    return f"mysql+pymysql://{encoded_user}:{encoded_password}@{db_host}:{db_port}/{db_name}?charset=utf8mb4"


def run_migrations_offline():
    """Offline 모드: SQL 스크립트 생성"""
    url = get_database_url()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def _cloud_sql_creator():
    """Cloud SQL Python Connector로 MySQL 연결 생성 (Alembic용)"""
    from google.cloud.sql.connector import Connector, IPTypes
    
    if not CLOUD_SQL_INSTANCE:
        raise ValueError("CLOUD_SQL_INSTANCE 환경 변수가 필요합니다.")
    
    print(f"[Alembic] Connecting to Cloud SQL instance: {CLOUD_SQL_INSTANCE} using PRIVATE IP")
    connector = Connector()
    return connector.connect(
        CLOUD_SQL_INSTANCE,
        "pymysql",
        user=DB_USER,
        password=DB_PASSWORD,
        db=DB_NAME,
        ip_type=IPTypes.PRIVATE,  # VPC 내부 연결 사용 (Cloud Run에서 권장)
    )


def run_migrations_online():
    """Online 모드: 실제 데이터베이스에 연결하여 마이그레이션 실행"""
    url = get_database_url()
    print(f"[Alembic] Database URL: {url[:50]}...")  # URL 일부만 출력 (비밀번호 마스킹)
    
    # Cloud SQL Python Connector 사용 시 (최우선순위)
    if USE_CLOUD_SQL_CONNECTOR:
        if not CLOUD_SQL_INSTANCE:
            raise ValueError(
                f"USE_CLOUD_SQL_CONNECTOR가 true이지만 CLOUD_SQL_INSTANCE가 설정되지 않았습니다. "
                f"현재 값: '{CLOUD_SQL_INSTANCE}'"
            )
        print(f"[Alembic] Creating engine with Cloud SQL Connector: {CLOUD_SQL_INSTANCE}")
        connectable = create_engine(
            "mysql+pymysql://",  # 빈 URL 사용
            creator=_cloud_sql_creator,
            pool_pre_ping=True,
            pool_recycle=3600,
            pool_timeout=30,
        )
    else:
        print(f"[Alembic] Creating engine with standard connection (URL-based)")
        connectable = create_engine(url, pool_pre_ping=True, pool_recycle=3600, pool_timeout=30)

    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()