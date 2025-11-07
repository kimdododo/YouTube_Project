"""
환경 변수 설정
"""
import os
from dotenv import load_dotenv

load_dotenv()

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

# 디버그: 환경 변수 로드 확인 (비밀번호는 마스킹)
print(f"[DEBUG] Config loaded:")
print(f"[DEBUG]   DB_USER: {DB_USER if DB_USER else '(empty)'}")
print(f"[DEBUG]   DB_PASSWORD: {'*' * len(DB_PASSWORD) if DB_PASSWORD else '(empty)'}")
print(f"[DEBUG]   DB_HOST: {DB_HOST}")
print(f"[DEBUG]   DB_PORT: {DB_PORT}")
print(f"[DEBUG]   DB_NAME: {DB_NAME}")
print(f"[DEBUG]   JWT_ALGO: {JWT_ALGO}")

