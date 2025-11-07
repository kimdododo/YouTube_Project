from passlib.context import CryptContext
import bcrypt

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# bcrypt는 비밀번호를 72바이트로 제한합니다
BCRYPT_MAX_PASSWORD_LENGTH = 72


def hash_password(password: str) -> str:
    """
    비밀번호를 해시합니다.
    bcrypt의 72바이트 제한을 고려하여 비밀번호를 처리합니다.
    """
    if not password:
        raise ValueError("비밀번호가 비어있습니다.")
    
    # 비밀번호를 UTF-8 바이트로 변환
    password_bytes = password.encode('utf-8')
    original_length = len(password_bytes)
    
    # 72바이트를 초과하면 자르기
    if original_length > BCRYPT_MAX_PASSWORD_LENGTH:
        password_bytes = password_bytes[:BCRYPT_MAX_PASSWORD_LENGTH]
        print(f"[WARN] 비밀번호가 72바이트를 초과하여 잘렸습니다. (원본: {original_length}바이트 -> 잘림: {len(password_bytes)}바이트)")
    
    # 최종 확인: 반드시 72바이트 이하인지 확인
    if len(password_bytes) > BCRYPT_MAX_PASSWORD_LENGTH:
        password_bytes = password_bytes[:BCRYPT_MAX_PASSWORD_LENGTH]
    
    # bcrypt에 직접 바이트를 전달 (가장 확실한 방법)
    # bcrypt.hashpw는 bytes를 받으므로 직접 사용
    try:
        # salt 생성
        salt = bcrypt.gensalt()
        # 비밀번호 해시 (bytes를 직접 전달)
        hashed = bcrypt.hashpw(password_bytes, salt)
        # bytes를 문자열로 변환 (passlib 형식과 호환)
        return hashed.decode('utf-8')
    except Exception as e:
        # fallback: passlib 사용 (바이트로 직접 전달)
        try:
            # 문자열로 변환 (72바이트 이하 보장)
            password_str = password_bytes.decode('utf-8', errors='ignore')
            return pwd_context.hash(password_str)
        except Exception as e2:
            print(f"[ERROR] 비밀번호 해시 실패: {e2}")
            raise ValueError(f"비밀번호 해시 처리 중 오류: {str(e2)}")


def verify_password(password: str, password_hash: str) -> bool:
    """
    비밀번호를 검증합니다.
    """
    if not password:
        return False
    
    # 비밀번호를 UTF-8 바이트로 변환
    password_bytes = password.encode('utf-8')
    
    # 72바이트를 초과하면 자르기
    if len(password_bytes) > BCRYPT_MAX_PASSWORD_LENGTH:
        password_bytes = password_bytes[:BCRYPT_MAX_PASSWORD_LENGTH]
    
    # 최종 확인
    if len(password_bytes) > BCRYPT_MAX_PASSWORD_LENGTH:
        password_bytes = password_bytes[:BCRYPT_MAX_PASSWORD_LENGTH]
    
    # bcrypt에 직접 바이트를 전달하여 검증
    try:
        # password_hash를 bytes로 변환
        hash_bytes = password_hash.encode('utf-8') if isinstance(password_hash, str) else password_hash
        # bcrypt.checkpw로 직접 검증 (bytes를 직접 전달)
        return bcrypt.checkpw(password_bytes, hash_bytes)
    except Exception as e:
        # fallback: passlib 사용
        try:
            password_str = password_bytes.decode('utf-8', errors='ignore')
            return pwd_context.verify(password_str, password_hash)
        except Exception as e2:
            print(f"[ERROR] 비밀번호 검증 실패: {e2}")
            return False


