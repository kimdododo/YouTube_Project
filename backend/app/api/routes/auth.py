from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from app.core.auth import create_access_token, get_current_user_id
from app.core.responses import ok
from app.core.database import get_db
from app.schemas.user import (
    UserCreate, 
    UserOut, 
    PasswordChangeRequest,
    EmailVerificationRequest,
    EmailVerificationResponse,
    ResendCodeRequest
)
from app.schemas.user_preference import TravelPreferenceCreate, TravelPreferenceResponse
# CRUD 함수 import (lazy import로 변경하여 모듈 로딩 문제 방지)
try:
    from app.crud.user import (
        create_user, 
        authenticate, 
        get_by_username_or_email,
        get_by_email,
        get_by_id, 
        update_password,
        verify_user_email
    )
except ImportError as e:
    # Import 실패 시 상세한 오류 정보 출력
    import traceback
    print(f"[ERROR] Failed to import from app.crud.user: {e}")
    print(f"[ERROR] Traceback: {traceback.format_exc()}")
    raise
from app.crud import email_verification as crud_email_verification
from app.utils.email_utils import send_verification_email
from app.core.config import EMAIL_VERIFICATION_MAX_ATTEMPTS
from app.crud.user_preference import (
    save_user_preferences,
    get_user_preferences,
    delete_user_preferences,
    save_user_keywords,
    get_user_keywords,
    delete_user_keywords,
)
from app.core.security import verify_password
from app.models.login_history import LoginHistory
from app.utils.ml_client import get_embeddings_batch
from typing import List
import traceback
import re
import asyncio

router = APIRouter(tags=["auth"])


@router.get("/debug/crud-check")
def debug_crud_check():
    """
    CRUD 함수 존재 여부 확인 엔드포인트
    배포된 서비스에서 실제로 함수가 import 가능한지 확인
    """
    import inspect
    import os
    from app.crud import user as crud_user
    
    functions_to_check = [
        'get_by_id',
        'get_by_email',
        'get_by_username',
        'get_by_username_or_email',
        'create_user',
        'authenticate',
        'verify_user_email',
        'update_password',
        'check_email_exists'
    ]
    
    results = {}
    for func_name in functions_to_check:
        if hasattr(crud_user, func_name):
            func = getattr(crud_user, func_name)
            results[func_name] = {
                "exists": True,
                "is_function": callable(func),
                "signature": str(inspect.signature(func)) if callable(func) else None,
                "file": inspect.getfile(func) if callable(func) else None
            }
        else:
            results[func_name] = {
                "exists": False,
                "is_function": False,
                "signature": None,
                "file": None
            }
    
    # user.py 파일 내용 일부 확인
    user_py_path = None
    file_content_preview = None
    try:
        if hasattr(crud_user, '__file__'):
            user_py_path = os.path.join(os.path.dirname(crud_user.__file__), 'user.py')
            if os.path.exists(user_py_path):
                with open(user_py_path, 'r', encoding='utf-8') as f:
                    lines = f.readlines()
                    # get_by_email 함수 주변 라인 추출
                    for i, line in enumerate(lines):
                        if 'def get_by_email' in line:
                            start = max(0, i - 2)
                            end = min(len(lines), i + 15)
                            file_content_preview = ''.join(lines[start:end])
                            break
    except Exception as e:
        file_content_preview = f"Error reading file: {str(e)}"
    
    # user_py_path가 None일 경우 처리
    if user_py_path is None:
        try:
            # 대체 경로 시도
            import app.crud.user as user_module
            if hasattr(user_module, '__file__'):
                user_py_path = user_module.__file__
        except:
            pass
    
    # Import 테스트
    import_test = {}
    try:
        from app.crud.user import get_by_email as test_get_by_email
        import_test["get_by_email"] = {
            "success": True,
            "type": str(type(test_get_by_email)),
            "callable": callable(test_get_by_email)
        }
    except Exception as e:
        import_test["get_by_email"] = {
            "success": False,
            "error": str(e),
            "error_type": type(e).__name__
        }
    
    return ok({
        "functions": results,
        "file_path": user_py_path,
        "file_exists": os.path.exists(user_py_path) if user_py_path else False,
        "file_content_preview": file_content_preview,
        "module_file": crud_user.__file__ if hasattr(crud_user, '__file__') else None,
        "import_test": import_test
    }).model_dump()


@router.get("/debug/email-config")
def debug_email_config():
    """
    이메일 설정 진단 엔드포인트
    런타임에 환경 변수가 제대로 로드되었는지 확인
    
    사용법:
    GET /api/auth/debug/email-config
    """
    import os
    from pathlib import Path
    from app.core.config import (
        SMTP_HOST,
        SMTP_PORT,
        SMTP_USERNAME,
        SMTP_PASSWORD,
        SMTP_FROM_EMAIL,
        SMTP_FROM_NAME
    )
    
    # 환경 변수 직접 확인
    env_smtp_host = os.getenv("SMTP_HOST", "").strip()
    env_smtp_port = os.getenv("SMTP_PORT", "").strip()
    env_smtp_username = os.getenv("SMTP_USERNAME", "").strip()
    env_smtp_password = os.getenv("SMTP_PASSWORD", "").strip()
    env_smtp_from_email = os.getenv("SMTP_FROM_EMAIL", "").strip()
    
    # .env 파일 경로 확인
    possible_paths = [
        Path(__file__).parent.parent.parent.parent / '.env',
        Path.cwd() / '.env',
        Path.cwd() / 'backend' / '.env',
    ]
    
    env_file_found = None
    for path in possible_paths:
        if path.exists():
            env_file_found = str(path.absolute())
            break
    
    # 문제점 확인
    issues = []
    if not SMTP_HOST:
        issues.append("SMTP_HOST is not set")
    if not SMTP_PORT:
        issues.append("SMTP_PORT is not set")
    if not SMTP_USERNAME:
        issues.append("SMTP_USERNAME is not set")
    if not SMTP_PASSWORD:
        issues.append("SMTP_PASSWORD is not set")
    if env_file_found is None:
        issues.append(".env file not found")
    if env_smtp_username != SMTP_USERNAME:
        issues.append("Environment variable SMTP_USERNAME differs from loaded config")
    if env_smtp_password != SMTP_PASSWORD:
        issues.append("Environment variable SMTP_PASSWORD differs from loaded config")
    
    return ok({
        "env_file": {
            "found": env_file_found is not None,
            "path": env_file_found,
            "checked_paths": [str(p.absolute()) for p in possible_paths]
        },
        "environment_variables": {
            "SMTP_HOST": env_smtp_host if env_smtp_host else "(empty)",
            "SMTP_PORT": env_smtp_port if env_smtp_port else "(empty)",
            "SMTP_USERNAME": env_smtp_username if env_smtp_username else "(empty)",
            "SMTP_PASSWORD": "SET" if env_smtp_password else "(empty)",
            "SMTP_PASSWORD_LENGTH": len(env_smtp_password) if env_smtp_password else 0,
            "SMTP_FROM_EMAIL": env_smtp_from_email if env_smtp_from_email else "(empty)",
        },
        "loaded_config": {
            "SMTP_HOST": SMTP_HOST if SMTP_HOST else "(empty)",
            "SMTP_PORT": SMTP_PORT,
            "SMTP_USERNAME": SMTP_USERNAME if SMTP_USERNAME else "(empty)",
            "SMTP_PASSWORD": "SET" if SMTP_PASSWORD else "(empty)",
            "SMTP_PASSWORD_LENGTH": len(SMTP_PASSWORD) if SMTP_PASSWORD else 0,
            "SMTP_FROM_EMAIL": SMTP_FROM_EMAIL if SMTP_FROM_EMAIL else "(empty)",
            "SMTP_FROM_NAME": SMTP_FROM_NAME,
        },
        "status": {
            "all_set": bool(SMTP_HOST and SMTP_PORT and SMTP_USERNAME and SMTP_PASSWORD),
            "issues": issues
        }
    }).model_dump()


@router.post("/register")
def register(payload: UserCreate, db: Session = Depends(get_db)):
    print(f"[DEBUG] Register request received: username={payload.username}, email={payload.email}")
    try:
        # DB 연결 테스트 (SQLAlchemy 2.0 방식)
        try:
            from sqlalchemy import text
            db.execute(text("SELECT 1"))
            print("[DEBUG] DB connection OK")
        except Exception as db_test_error:
            print(f"[ERROR] DB connection test failed: {db_test_error}")
            print(f"[ERROR] DB connection traceback: {traceback.format_exc()}")
            raise HTTPException(status_code=500, detail=f"데이터베이스 연결 실패: {str(db_test_error)}")
        
        # 사용자 생성 (is_verified=False로 생성)
        # create_user 함수 내부에서 이메일 중복 체크를 수행함
        print(f"[DEBUG] Creating user: {payload.username}")
        try:
            user = create_user(db, payload.username, payload.email, payload.password, is_verified=False)
        except ValueError as ve:
            # 이메일 중복 등 검증 오류
            if "이미 사용 중인 이메일" in str(ve):
                print(f"[DEBUG] Email already exists: {payload.email}")
                raise HTTPException(status_code=400, detail=str(ve))
            raise HTTPException(status_code=400, detail=str(ve))
        print(f"[DEBUG] User created successfully: id={user.id}, username={user.username}, is_verified={user.is_verified}")
        
        # 인증코드 생성 및 저장
        try:
            verification = crud_email_verification.create_verification_code(
                db=db,
                user_id=user.id,
                code_length=6,
                expiry_minutes=3
            )
            print(f"[DEBUG] Verification code created: code={verification.code}, expires_at={verification.expires_at}")
            
            # 이메일 발송
            print(f"[DEBUG] ===== Starting email sending process =====")
            print(f"[DEBUG] User ID: {user.id}")
            print(f"[DEBUG] User Email: {user.email}")
            print(f"[DEBUG] Verification Code: {verification.code}")
            print(f"[DEBUG] Expires At: {verification.expires_at}")
            
            email_sent = send_verification_email(
                to_email=user.email,
                verification_code=verification.code,
                username=user.username
            )
            
            if not email_sent:
                print(f"[ERROR] ✗✗✗ Failed to send verification email to {user.email} ✗✗✗")
                print(f"[ERROR] User created (ID: {user.id}) but email verification failed.")
                print(f"[ERROR] User can resend code later using /api/auth/resend-code endpoint")
                print(f"[ERROR] Check the [Email] logs above for detailed error information")
                # 이메일 발송 실패해도 사용자는 생성되었으므로 계속 진행
                # (나중에 재전송 가능)
            else:
                print(f"[DEBUG] ✓✓✓ Email sent successfully! ✓✓✓")
            
        except Exception as email_error:
            print(f"[ERROR] ✗✗✗ Exception during email sending process ✗✗✗")
            print(f"[ERROR] Error: {email_error}")
            print(f"[ERROR] Traceback: {traceback.format_exc()}")
            # 이메일 발송 실패해도 사용자는 생성되었으므로 계속 진행
        
        return ok({
            "message": "이메일 인증이 필요합니다. 이메일로 발송된 인증코드를 입력해주세요.",
            "user": UserOut.model_validate(user).model_dump(),
            "requires_verification": True,
            "email": user.email  # 프론트엔드에서 사용할 수 있도록 이메일도 반환
        }).model_dump()
    
    except HTTPException:
        # HTTPException은 그대로 재발생
        raise
    except IntegrityError as e:
        # DB 제약 조건 위반 (중복 등)
        db.rollback()
        error_msg = str(e.orig) if hasattr(e, 'orig') else str(e)
        print(f"[ERROR] IntegrityError during registration: {error_msg}")
        print(f"[ERROR] Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=400, detail="이미 존재하는 사용자입니다.")
    except SQLAlchemyError as e:
        # 일반적인 DB 에러
        db.rollback()
        error_msg = str(e)
        print(f"[ERROR] SQLAlchemyError during registration: {error_msg}")
        print(f"[ERROR] Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"데이터베이스 오류: {error_msg}")
    except Exception as e:
        # 기타 예외
        db.rollback()
        error_msg = str(e)
        print(f"[ERROR] Unexpected error during registration: {error_msg}")
        print(f"[ERROR] Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"회원가입 처리 중 오류가 발생했습니다: {error_msg}")


@router.post("/token")
def issue_token(
    request: Request,  # FastAPI가 자동으로 주입
    form: OAuth2PasswordRequestForm = Depends(), 
    db: Session = Depends(get_db)
):
    """
    로그인 및 토큰 발급
    로그인 성공 시 DB에 로그인 이력을 저장합니다.
    """
    print(f"[DEBUG] Login attempt: username={form.username}")
    try:
        user = authenticate(db, form.username, form.password)
        if not user:
            print(f"[WARN] Authentication failed for username: {form.username}")
            # 사용자 존재 여부 확인
            existing_user = get_by_username_or_email(db, form.username)
            if existing_user:
                print(f"[WARN] User exists but password mismatch")
                raise HTTPException(status_code=401, detail="비밀번호가 일치하지 않습니다.")
            else:
                print(f"[WARN] User not found")
                raise HTTPException(status_code=401, detail="사용자를 찾을 수 없습니다. 이메일 또는 사용자 이름을 확인해주세요.")
        
        # 이메일 인증 여부 확인
        if not user.is_verified:
            print(f"[WARN] User {user.id} attempted login but email not verified")
            raise HTTPException(
                status_code=403,
                detail="이메일 인증이 완료되지 않았습니다. 이메일로 발송된 인증코드를 입력해주세요."
            )
    except HTTPException:
        raise
    except Exception as e:
        print(f"[ERROR] Authentication error: {str(e)}")
        print(f"[ERROR] Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=401, detail="로그인 처리 중 오류가 발생했습니다.")
    
    # 로그인 이력 저장
    try:
        # 클라이언트 IP 주소 가져오기
        client_ip = None
        user_agent = None
        
        try:
            # X-Forwarded-For 헤더 확인 (프록시/로드밸런서 환경)
            forwarded_for = request.headers.get("X-Forwarded-For")
            if forwarded_for:
                client_ip = forwarded_for.split(",")[0].strip()
            else:
                client_ip = request.client.host if request.client else None
            
            # User-Agent 헤더 가져오기
            user_agent = request.headers.get("User-Agent", "")
            if user_agent:
                user_agent = user_agent[:500]  # 최대 500자
        except Exception as req_error:
            print(f"[WARN] Request 정보 가져오기 실패: {req_error}")
        
        # 로그인 이력 생성
        login_history = LoginHistory(
            user_id=user.id,
            ip_address=client_ip,
            user_agent=user_agent
        )
        db.add(login_history)
        db.commit()
        print(f"[DEBUG] Login history saved: user_id={user.id}, ip={client_ip}, user_agent={user_agent[:50] if user_agent else None}")
    except Exception as e:
        # 로그인 이력 저장 실패해도 로그인은 성공 처리
        db.rollback()
        print(f"[WARN] Failed to save login history: {str(e)}")
        print(f"[WARN] Traceback: {traceback.format_exc()}")
    
    # JWT 토큰 생성
    token = create_access_token(str(user.id))
    
    # 사용자 여행 취향도 함께 반환 (있으면)
    try:
        preferences = get_user_preferences(db, user.id)
    except Exception as e:
        print(f"[WARN] Failed to get user preferences: {e}")
        preferences = []
    
    return ok({
        "access_token": token, 
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email
        },
        "travel_preferences": preferences
    }).model_dump()


@router.post("/preferences", response_model=TravelPreferenceResponse)
def save_preferences(
    payload: TravelPreferenceCreate,
    current_user_id_str: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """
    사용자 여행 취향 저장 (로그인 필요)
    """
    try:
        current_user_id = int(current_user_id_str)
        # 취향 저장
        keywords = payload.keywords or []
        unique_keywords: list[str] = []
        for key in keywords:
            if not key:
                continue
            normalized = key.strip()
            if not normalized:
                continue
            if normalized in unique_keywords:
                continue
            unique_keywords.append(normalized)
            if len(unique_keywords) >= 5:
                break

        save_user_preferences(db, current_user_id, payload.preference_ids)
        save_user_keywords(db, current_user_id, unique_keywords)
        
        saved_preferences = get_user_preferences(db, current_user_id)
        saved_keywords = get_user_keywords(db, current_user_id)
        
        return TravelPreferenceResponse(
            user_id=current_user_id,
            preference_ids=saved_preferences,
            keywords=saved_keywords
        )
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user ID")
    except Exception as e:
        print(f"[ERROR] Error saving preferences: {str(e)}")
        print(f"[ERROR] Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"취향 저장 중 오류가 발생했습니다: {str(e)}")


@router.get("/me", response_model=UserOut)
def get_current_user(
    current_user_id_str: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """
    현재 로그인한 사용자 정보 조회
    """
    try:
        current_user_id = int(current_user_id_str)
        user = get_by_id(db, current_user_id)
        if not user:
            raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")
        return UserOut.model_validate(user).model_dump()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user ID")
    except Exception as e:
        print(f"[ERROR] Error getting current user: {str(e)}")
        raise HTTPException(status_code=500, detail=f"사용자 정보 조회 중 오류가 발생했습니다: {str(e)}")


@router.get("/preferences", response_model=TravelPreferenceResponse)
def get_preferences(
    current_user_id_str: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """
    사용자 여행 취향 조회 (로그인 필요)
    """
    try:
        current_user_id = int(current_user_id_str)
        preferences = get_user_preferences(db, current_user_id)
        keywords = get_user_keywords(db, current_user_id)
        return TravelPreferenceResponse(
            user_id=current_user_id,
            preference_ids=preferences,
            keywords=keywords
        )
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user ID")
    except Exception as e:
        print(f"[ERROR] Error getting preferences: {str(e)}")
        raise HTTPException(status_code=500, detail=f"취향 조회 중 오류가 발생했습니다: {str(e)}")


@router.delete("/preferences")
def delete_preferences(
    current_user_id_str: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """
    사용자 여행 취향 삭제 (로그인 필요)
    """
    try:
        current_user_id = int(current_user_id_str)
        deleted_prefs = delete_user_preferences(db, current_user_id)
        deleted_keywords = delete_user_keywords(db, current_user_id)
        return ok({"deleted": deleted_prefs or deleted_keywords}).model_dump()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user ID")
    except Exception as e:
        print(f"[ERROR] Error deleting preferences: {str(e)}")
        raise HTTPException(status_code=500, detail=f"취향 삭제 중 오류가 발생했습니다: {str(e)}")


def _validate_new_password(password: str):
    if len(password) < 10:
        raise HTTPException(status_code=400, detail="비밀번호는 10자 이상이어야 합니다.")
    categories = 0
    if any(c.isalpha() for c in password):
        categories += 1
    if any(c.isdigit() for c in password):
        categories += 1
    if any(not c.isalnum() for c in password):
        categories += 1
    if categories < 2:
        raise HTTPException(
            status_code=400,
            detail="비밀번호는 영문, 숫자, 특수문자 중 2종류 이상을 포함해야 합니다."
        )


@router.post("/change-password")
def change_password(
    payload: PasswordChangeRequest,
    current_user_id_str: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    try:
        current_user_id = int(current_user_id_str)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user ID")

    user = get_by_id(db, current_user_id)
    if not user:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")

    if not verify_password(payload.current_password, user.password_hash):
        raise HTTPException(status_code=400, detail="현재 비밀번호가 일치하지 않습니다.")

    if verify_password(payload.new_password, user.password_hash):
        raise HTTPException(status_code=400, detail="새 비밀번호가 기존 비밀번호와 동일합니다.")

    _validate_new_password(payload.new_password)

    try:
        update_password(db, current_user_id, payload.new_password)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"비밀번호 변경 중 오류가 발생했습니다: {str(e)}")

    return ok({"message": "비밀번호가 변경되었습니다. 다시 로그인해주세요."}).model_dump()


@router.post("/keywords/embeddings")
async def get_keyword_embeddings(
    keywords: List[str],
    current_user_id_str: str = Depends(get_current_user_id)
):
    """
    키워드 목록을 임베딩 벡터로 변환 (word2vec 기반 키워드 클라우드용)
    [DEPRECATED] 이 엔드포인트는 유지하되, 새로운 /my_keywords 사용 권장
    """
    try:
        if not keywords or len(keywords) == 0:
            return ok({"embeddings": []}).model_dump()
        
        # 키워드를 한글로 변환 (키워드 ID -> 한글 라벨)
        keyword_labels = {
            'solo': '혼자여행',
            'budget': '가성비여행',
            'vlog': '브이로그',
            'aesthetic': '감성여행',
            'domestic': '국내여행',
            'global': '해외여행',
            'oneday': '당일치기',
            'food': '맛집투어',
            'stay': '숙소리뷰',
            'camping': '캠핑',
            'cafe': '카페투어'
        }
        
        # 키워드 ID를 한글 라벨로 변환
        texts = [keyword_labels.get(kw, kw) for kw in keywords]
        
        # 배치로 임베딩 가져오기
        embeddings = await get_embeddings_batch(texts)
        
        if embeddings is None:
            # ML API 실패 시 빈 배열 반환 (프론트엔드에서 폴백 처리)
            return ok({"embeddings": []}).model_dump()
        
        # 키워드와 임베딩을 매핑
        result = [
            {"keyword": kw, "embedding": emb}
            for kw, emb in zip(keywords, embeddings)
        ]
        
        return ok({"embeddings": result}).model_dump()
    except Exception as e:
        print(f"[ERROR] Error getting keyword embeddings: {str(e)}")
        print(f"[ERROR] Traceback: {traceback.format_exc()}")
        # 에러 발생 시 빈 배열 반환 (프론트엔드에서 폴백 처리)
        return ok({"embeddings": []}).model_dump()


@router.get("/my_keywords")
def get_my_keywords(
    top_k: int = 7,
    current_user_id_str: str = Depends(get_current_user_id),
    db: Session = Depends(get_db)
):
    """
    사용자 키워드 기반 word2vec 유사 키워드 추천 (더미 데이터)
    
    사용자가 선택한 키워드를 기반으로 유사한 키워드 Top-K를 반환합니다.
    실제 word2vec 모델이 없으므로 더미 데이터로 시뮬레이션합니다.
    
    Returns:
        [
            {"word": "카페투어", "score": 0.91},
            {"word": "디저트", "score": 0.88},
            ...
        ]
    """
    try:
        user_id = int(current_user_id_str)
        
        # 사용자가 선택한 키워드 가져오기
        user_keywords = get_user_keywords(db, user_id)
        
        if not user_keywords:
            return ok([]).model_dump()
        
        # 키워드 ID -> 한글 라벨 매핑
        keyword_labels = {
            'solo': '혼자여행',
            'budget': '가성비여행',
            'vlog': '브이로그',
            'aesthetic': '감성여행',
            'domestic': '국내여행',
            'global': '해외여행',
            'oneday': '당일치기',
            'food': '맛집투어',
            'stay': '숙소리뷰',
            'camping': '캠핑',
            'cafe': '카페투어'
        }
        
        # 사용자 키워드를 한글로 변환
        user_keyword_labels = [keyword_labels.get(kw, kw) for kw in user_keywords]
        
        # 더미 word2vec 시뮬레이션: 키워드 간 유사도 매트릭스
        # 실제 word2vec 모델이 있다면 여기서 model.similar_by_vector() 사용
        all_keywords = list(keyword_labels.values())
        
        # 키워드 그룹 정의 (유사한 키워드끼리 묶기)
        keyword_groups = {
            '카페투어': ['카페투어', '디저트', '브런치', '로컬맛집', '신메뉴'],
            '맛집투어': ['맛집투어', '한식', '로컬맛집', '숨은식당', '미슐랭'],
            '혼자여행': ['혼자여행', '감성여행', '당일치기', '사진스팟', '포토존'],
            '감성여행': ['감성여행', '혼자여행', '사진스팟', '포토존', '트렌디'],
            '국내여행': ['국내여행', '당일치기', '로컬', '카페거리', '거리'],
            '해외여행': ['해외여행', '이국적', '모험심', '트렌디', '전시'],
            '캠핑': ['캠핑', '자연', '숲속', '등산', '트래킹'],
            '브이로그': ['브이로그', '사진스팟', '포토존', '트렌디', '전시'],
            '가성비여행': ['가성비여행', '로컬', '거리', '한입', '챌린지'],
            '당일치기': ['당일치기', '국내여행', '카페거리', '거리', '야경'],
            '숙소리뷰': ['숙소리뷰', '럭셔리', '휴양', '여유', '평온']
        }
        
        # 사용자 키워드와 유사한 키워드 찾기
        similar_keywords = {}
        
        for user_kw in user_keyword_labels:
            # 직접 매칭되는 그룹 찾기
            for group_key, group_keywords in keyword_groups.items():
                if user_kw in group_keywords or user_kw == group_key:
                    for similar_kw in group_keywords:
                        if similar_kw != user_kw:  # 자기 자신 제외
                            # 유사도 점수 계산 (그룹 내 위치에 따라)
                            base_score = 0.85
                            idx = group_keywords.index(similar_kw) if similar_kw in group_keywords else len(group_keywords)
                            score = base_score - (idx * 0.05)
                            
                            # 이미 있는 키워드면 더 높은 점수로 업데이트
                            if similar_kw not in similar_keywords or similar_keywords[similar_kw] < score:
                                similar_keywords[similar_kw] = min(0.99, max(0.5, score))
        
        # 사용자가 선택한 키워드도 포함 (점수 1.0)
        for user_kw in user_keyword_labels:
            similar_keywords[user_kw] = 1.0
        
        # 점수 기준으로 정렬하고 Top-K 선택
        sorted_keywords = sorted(
            similar_keywords.items(),
            key=lambda x: x[1],
            reverse=True
        )[:top_k]
        
        # 결과 포맷: [{"word": "키워드", "score": 0.91}, ...]
        result = [
            {"word": word, "score": round(score, 2)}
            for word, score in sorted_keywords
        ]
        
        return ok(result).model_dump()
        
    except Exception as e:
        print(f"[ERROR] Error getting my keywords: {str(e)}")
        print(f"[ERROR] Traceback: {traceback.format_exc()}")
        # 에러 발생 시 빈 배열 반환
        return ok([]).model_dump()


@router.post("/verify-email", response_model=EmailVerificationResponse)
def verify_email(
    payload: EmailVerificationRequest,
    db: Session = Depends(get_db)
):
    """
    이메일 인증코드 검증
    인증코드가 맞고 만료되지 않았으면 사용자 이메일을 인증 완료 처리
    """
    try:
        # 사용자 조회
        user = get_by_username_or_email(db, payload.email)
        if not user:
            raise HTTPException(status_code=404, detail="해당 이메일로 가입된 사용자를 찾을 수 없습니다.")
        
        # 이미 인증된 경우
        if user.is_verified:
            return EmailVerificationResponse(
                success=True,
                message="이미 인증된 이메일입니다."
            )
        
        # 유효한 인증코드 조회
        verification = crud_email_verification.get_valid_verification_code(
            db=db,
            user_id=user.id,
            code=payload.code
        )
        
        if not verification:
            # 최근 시도 횟수 확인 (brute force 방지)
            recent_attempts = crud_email_verification.get_recent_verification_attempts(
                db=db,
                user_id=user.id,
                minutes=10
            )
            
            if recent_attempts >= EMAIL_VERIFICATION_MAX_ATTEMPTS:
                raise HTTPException(
                    status_code=429,
                    detail=f"인증 시도 횟수가 너무 많습니다. {EMAIL_VERIFICATION_MAX_ATTEMPTS}회 이상 시도하셨습니다. 잠시 후 다시 시도해주세요."
                )
            
            raise HTTPException(
                status_code=400,
                detail="인증코드가 올바르지 않거나 만료되었습니다. 다시 확인해주세요."
            )
        
        # 인증코드 사용 처리
        crud_email_verification.mark_verification_code_as_used(db, verification.id)
        
        # 사용자 이메일 인증 완료 처리
        verify_user_email(db, user.id)
        
        print(f"[DEBUG] Email verified successfully for user {user.id} ({user.email})")
        
        return EmailVerificationResponse(
            success=True,
            message="이메일 인증이 완료되었습니다. 이제 로그인하실 수 있습니다."
        )
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"[ERROR] Error verifying email: {str(e)}")
        print(f"[ERROR] Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"이메일 인증 처리 중 오류가 발생했습니다: {str(e)}")


@router.post("/resend-code", response_model=EmailVerificationResponse)
def resend_verification_code(
    payload: ResendCodeRequest,
    db: Session = Depends(get_db)
):
    """
    인증코드 재전송
    기존 코드를 무효화하고 새로운 인증코드를 발송
    """
    try:
        # 사용자 조회
        user = get_by_username_or_email(db, payload.email)
        if not user:
            raise HTTPException(status_code=404, detail="해당 이메일로 가입된 사용자를 찾을 수 없습니다.")
        
        # 이미 인증된 경우
        if user.is_verified:
            return EmailVerificationResponse(
                success=True,
                message="이미 인증된 이메일입니다."
            )
        
        # 최근 재전송 횟수 확인 (과도한 재전송 방지)
        recent_attempts = crud_email_verification.get_recent_verification_attempts(
            db=db,
            user_id=user.id,
            minutes=5
        )
        
        if recent_attempts >= 3:
            raise HTTPException(
                status_code=429,
                detail="재전송 요청이 너무 많습니다. 5분 후 다시 시도해주세요."
            )
        
        # 기존 코드 무효화 및 새 코드 생성
        crud_email_verification.invalidate_user_verification_codes(db, user.id)
        
        verification = crud_email_verification.create_verification_code(
            db=db,
            user_id=user.id,
            code_length=6,
            expiry_minutes=10
        )
        print(f"[DEBUG] New verification code created: code={verification.code}, expires_at={verification.expires_at}")
        
        # 이메일 발송
        email_sent = send_verification_email(
            to_email=user.email,
            verification_code=verification.code,
            username=user.username
        )
        
        if not email_sent:
            raise HTTPException(
                status_code=500,
                detail="인증코드 이메일 발송에 실패했습니다. 잠시 후 다시 시도해주세요."
            )
        
        return EmailVerificationResponse(
            success=True,
            message="인증코드가 재전송되었습니다. 이메일을 확인해주세요."
        )
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"[ERROR] Error resending verification code: {str(e)}")
        print(f"[ERROR] Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"인증코드 재전송 처리 중 오류가 발생했습니다: {str(e)}")


