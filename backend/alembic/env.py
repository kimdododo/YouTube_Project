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
)  # noqa: ensure models are imported

from app.core.config import DB_USER, DB_PASSWORD, DB_HOST, DB_PORT, DB_NAME

target_metadata = Base.metadata


def get_database_url() -> str:
    """데이터베이스 연결 URL 생성 (Unix 소켓 및 TCP 지원)"""
    encoded_user = quote_plus(str(DB_USER))
    encoded_password = quote_plus(str(DB_PASSWORD))
    db_host = (DB_HOST or "").strip()
    db_port = str(DB_PORT).strip() if DB_PORT else "3306"
    db_name = str(DB_NAME or "yt").strip()

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


def run_migrations_online():
    """Online 모드: 실제 데이터베이스에 연결하여 마이그레이션 실행"""
    url = get_database_url()
    connectable = create_engine(url)

    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()