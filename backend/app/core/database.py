"""
데이터베이스 연결 설정
.env에서 DB 연결 정보를 읽어 SQLAlchemy 엔진을 생성합니다.
"""
from sqlalchemy import create_engine
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
DATABASE_URL = f"mysql+pymysql://{encoded_user}:{encoded_password}@{DB_HOST}:{DB_PORT}/{DB_NAME}?charset=utf8mb4"

# 디버그: 연결 정보 출력 (비밀번호는 마스킹)
print(f"[DEBUG] Database connection: mysql+pymysql://{DB_USER}:{'*' * len(str(DB_PASSWORD))}@{DB_HOST}:{DB_PORT}/{DB_NAME}")

# SQLAlchemy 엔진 생성
engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,  # 연결 상태 확인
    pool_recycle=3600,   # 1시간마다 연결 재생성
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
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

