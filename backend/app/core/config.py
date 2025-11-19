"""
환경 변수 설정
"""
import os
from dotenv import load_dotenv
from pathlib import Path

# .env 파일 경로 명시적으로 지정
# 여러 가능한 경로 확인 (작업 디렉토리가 다를 수 있음)
possible_paths = [
    Path(__file__).parent.parent / '.env',  # backend/.env
    Path.cwd() / '.env',  # 현재 작업 디렉토리/.env
    Path.cwd() / 'backend' / '.env',  # 프로젝트 루트에서 실행 시
]

env_path = None
for path in possible_paths:
    if path.exists():
        env_path = path
        break

if env_path:
    load_dotenv(dotenv_path=env_path, override=True)
    print(f"[Config] .env file loaded from: {env_path.absolute()}")
else:
    # .env 파일이 없어도 환경 변수는 로드 시도 (시스템 환경 변수 사용)
    load_dotenv(override=False)
    print(f"[Config] WARNING: .env file not found in any of these locations:")
    for path in possible_paths:
        print(f"[Config]   - {path.absolute()}")
    print(f"[Config] Using system environment variables or defaults")

# 데이터베이스 설정
DB_USER = os.getenv("DB_USER", "").strip()
DB_PASSWORD = os.getenv("DB_PASSWORD", "").strip()
# Cloud Run에서는 /cloudsql/PROJECT_ID:REGION:INSTANCE_NAME 형식 필수
DB_HOST = os.getenv("DB_HOST", "").strip()
DB_PORT = os.getenv("DB_PORT", "3306").strip()
DB_NAME = os.getenv("DB_NAME", "yt").strip()
# Cloud SQL Python Connector 설정 (선택)
USE_CLOUD_SQL_CONNECTOR_RAW = os.getenv("USE_CLOUD_SQL_CONNECTOR", "false").strip()
USE_CLOUD_SQL_CONNECTOR = USE_CLOUD_SQL_CONNECTOR_RAW.lower() in ("1", "true", "yes")
CLOUD_SQL_INSTANCE = os.getenv("CLOUD_SQL_INSTANCE", "").strip()

# 디버그: Cloud SQL Connector 설정 확인
print(f"[DEBUG] USE_CLOUD_SQL_CONNECTOR (raw): '{USE_CLOUD_SQL_CONNECTOR_RAW}'")
print(f"[DEBUG] USE_CLOUD_SQL_CONNECTOR (parsed): {USE_CLOUD_SQL_CONNECTOR}")
print(f"[DEBUG] CLOUD_SQL_INSTANCE: '{CLOUD_SQL_INSTANCE}'")

# JWT/SECURITY
JWT_SECRET = os.getenv("JWT_SECRET", "CHANGE_ME_SECRET").strip()
JWT_ALGO = os.getenv("JWT_ALGO", "HS256").strip()
JWT_ACCESS_MINUTES = int(os.getenv("JWT_ACCESS_MINUTES", "60").strip())

# Redis
REDIS_URL = os.getenv("REDIS_URL", "").strip()

# Model Server
MODEL_SERVER_URL = os.getenv("MODEL_SERVER_URL", "").strip()

# SMTP 설정 (이메일 발송)
SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com").strip()
# SMTP_PORT 안전하게 변환 (빈 값이나 잘못된 값 처리)
try:
    smtp_port_str = os.getenv("SMTP_PORT", "587").strip()
    SMTP_PORT = int(smtp_port_str) if smtp_port_str else 587
except (ValueError, AttributeError):
    print(f"[Config] WARNING: Invalid SMTP_PORT value, using default 587")
    SMTP_PORT = 587
SMTP_USERNAME = os.getenv("SMTP_USERNAME", "").strip()
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "").strip()
SMTP_FROM_EMAIL = os.getenv("SMTP_FROM_EMAIL", SMTP_USERNAME).strip()
SMTP_FROM_NAME = os.getenv("SMTP_FROM_NAME", "여유").strip()

# 이메일 인증 설정
EMAIL_VERIFICATION_CODE_EXPIRY_MINUTES = int(os.getenv("EMAIL_VERIFICATION_CODE_EXPIRY_MINUTES", "3").strip())
EMAIL_VERIFICATION_CODE_LENGTH = int(os.getenv("EMAIL_VERIFICATION_CODE_LENGTH", "6").strip())
EMAIL_VERIFICATION_MAX_ATTEMPTS = int(os.getenv("EMAIL_VERIFICATION_MAX_ATTEMPTS", "5").strip())

# 디버그: 환경 변수 로드 확인 (비밀번호는 마스킹)
print(f"[DEBUG] Config loaded:")
print(f"[DEBUG]   DB_USER: {DB_USER if DB_USER else '(empty)'}")
print(f"[DEBUG]   DB_PASSWORD: {'*' * len(DB_PASSWORD) if DB_PASSWORD else '(empty)'}")
print(f"[DEBUG]   DB_HOST: {DB_HOST}")
print(f"[DEBUG]   DB_PORT: {DB_PORT}")
print(f"[DEBUG]   DB_NAME: {DB_NAME}")
print(f"[DEBUG]   USE_CLOUD_SQL_CONNECTOR: {USE_CLOUD_SQL_CONNECTOR}")
if USE_CLOUD_SQL_CONNECTOR:
    print(f"[DEBUG]   CLOUD_SQL_INSTANCE: {CLOUD_SQL_INSTANCE}")
print(f"[DEBUG]   JWT_ALGO: {JWT_ALGO}")
print(f"[DEBUG]   SMTP_HOST: {SMTP_HOST}")
print(f"[DEBUG]   SMTP_PORT: {SMTP_PORT}")
print(f"[DEBUG]   SMTP_USERNAME: {SMTP_USERNAME if SMTP_USERNAME else '(empty)'}")
print(f"[DEBUG]   SMTP_PASSWORD: {'SET' if SMTP_PASSWORD else '(empty)'}")
print(f"[DEBUG]   SMTP_FROM_EMAIL: {SMTP_FROM_EMAIL if SMTP_FROM_EMAIL else '(empty)'}")

