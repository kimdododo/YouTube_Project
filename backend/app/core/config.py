"""
환경 변수 설정
"""
import os
from dotenv import load_dotenv
from pathlib import Path

# .env 파일 경로 명시적으로 지정
env_path = Path(__file__).parent.parent / '.env'
load_dotenv(dotenv_path=env_path)

# .env 파일 로드 확인
if env_path.exists():
    print(f"[Config] .env file loaded from: {env_path}")
else:
    print(f"[Config] WARNING: .env file not found at: {env_path}")
    print(f"[Config] Using environment variables or defaults")

# 데이터베이스 설정
DB_USER = os.getenv("DB_USER", "").strip()
DB_PASSWORD = os.getenv("DB_PASSWORD", "").strip()
DB_HOST = os.getenv("DB_HOST", "cloud-sql-proxy").strip()
DB_PORT = os.getenv("DB_PORT", "3306").strip()
DB_NAME = os.getenv("DB_NAME", "yt").strip()

# JWT/SECURITY
JWT_SECRET = os.getenv("JWT_SECRET", "CHANGE_ME_SECRET").strip()
JWT_ALGO = os.getenv("JWT_ALGO", "HS256").strip()
JWT_ACCESS_MINUTES = int(os.getenv("JWT_ACCESS_MINUTES", "60").strip())

# Redis
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0").strip()

# SMTP 설정 (이메일 발송)
SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com").strip()
SMTP_PORT = int(os.getenv("SMTP_PORT", "587").strip())
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
print(f"[DEBUG]   JWT_ALGO: {JWT_ALGO}")
print(f"[DEBUG]   SMTP_HOST: {SMTP_HOST}")
print(f"[DEBUG]   SMTP_PORT: {SMTP_PORT}")
print(f"[DEBUG]   SMTP_USERNAME: {SMTP_USERNAME if SMTP_USERNAME else '(empty)'}")
print(f"[DEBUG]   SMTP_PASSWORD: {'SET' if SMTP_PASSWORD else '(empty)'}")
print(f"[DEBUG]   SMTP_FROM_EMAIL: {SMTP_FROM_EMAIL if SMTP_FROM_EMAIL else '(empty)'}")

