"""
데이터베이스 연결 설정
.env에서 DB 연결 정보를 읽어 SQLAlchemy 엔진을 생성합니다.
"""
from sqlalchemy import create_engine, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from urllib.parse import quote_plus
from app.core.config import DB_USER, DB_PASSWORD, DB_HOST, DB_PORT, DB_NAME

# 환경 변수 검증
if not DB_USER:
    raise ValueError("DB_USER 환경 변수가 설정되지 않았습니다. .env 파일을 확인하세요.")
if not DB_PASSWORD:
    raise ValueError("DB_PASSWORD 환경 변수가 설정되지 않았습니다. .env 파일을 확인하세요.")

# SQLAlchemy 연결 URL 생성 (특수 문자 URL 인코딩)
# 비밀번호에 특수 문자가 있을 수 있으므로 quote_plus 사용
encoded_password = quote_plus(str(DB_PASSWORD))
encoded_user = quote_plus(str(DB_USER))

# Cloud SQL Unix 소켓 연결만 사용 (로컬 데이터베이스 미지원)
# DB_HOST는 /cloudsql/PROJECT_ID:REGION:INSTANCE_NAME 형식이어야 함
if not DB_HOST:
    raise ValueError("DB_HOST 환경 변수가 설정되지 않았습니다. Cloud SQL Unix socket 경로(/cloudsql/...)를 설정하세요.")
if not isinstance(DB_HOST, str) or not DB_HOST.startswith('/cloudsql/'):
    raise ValueError(f"DB_HOST는 Cloud SQL Unix socket 경로(/cloudsql/...)여야 합니다. 현재 값: {DB_HOST} (타입: {type(DB_HOST)})")

# Unix 소켓 사용 (Cloud SQL)
# PyMySQL에서 Unix 소켓을 사용하려면 URL 쿼리 파라미터로 unix_socket을 전달해야 함
import os

# Unix socket 파일 존재 여부 확인 (디버깅용)
socket_exists = os.path.exists(DB_HOST)
print(f"[DEBUG] Unix socket path: {DB_HOST}")
print(f"[DEBUG] Unix socket exists: {socket_exists}")

if not socket_exists:
    print(f"[WARNING] Unix socket file not found at {DB_HOST}")
    print(f"[WARNING] This may indicate Cloud SQL connection is not properly configured")
    print(f"[WARNING] Checking if socket directory exists...")
    socket_dir = os.path.dirname(DB_HOST)
    if os.path.exists(socket_dir):
        print(f"[DEBUG] Socket directory exists: {socket_dir}")
        try:
            print(f"[DEBUG] Files in socket directory: {os.listdir(socket_dir)}")
        except Exception as e:
            print(f"[DEBUG] Cannot list socket directory: {e}")
    else:
        print(f"[ERROR] Socket directory does not exist: {socket_dir}")
        print(f"[ERROR] Cloud SQL Unix socket will be created by Cloud Run at runtime")

# Cloud SQL Unix socket 연결을 위한 올바른 URL 형식
# URL 쿼리 파라미터로 unix_socket을 전달해야 PyMySQL이 올바르게 인식함
DATABASE_URL = (
    f"mysql+pymysql://{encoded_user}:{encoded_password}@/{DB_NAME}"
    f"?unix_socket={quote_plus(DB_HOST)}&charset=utf8mb4"
)
connect_args = {
    'sql_mode': 'TRADITIONAL',
    'connect_timeout': 5,
}
print(f"[DEBUG] Database connection (Cloud SQL Unix socket): mysql+pymysql://{DB_USER}:{'*' * len(str(DB_PASSWORD))}@/unix_socket={DB_HOST}/{DB_NAME}")

# SQLAlchemy 엔진 생성
# Unix socket은 URL 쿼리 파라미터로 전달되므로 connect_args에는 추가 설정만 포함
engine = create_engine(
    DATABASE_URL,
    connect_args=connect_args,
    pool_pre_ping=True,  # 연결 상태 확인
    pool_recycle=3600,   # 1시간마다 연결 재생성
    pool_size=10,        # 연결 풀 크기 (기본값 5 → 10으로 증가)
    max_overflow=20,     # 추가 연결 허용 (기본값 10 → 20으로 증가)
    pool_timeout=10,     # 연결 대기 시간 10초로 단축 (30초 → 10초)
    echo=False  # SQL 쿼리 로깅 (개발 시 True로 설정)
)

# 세션 팩토리 생성
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base 클래스 (모델이 상속할 클래스)
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

