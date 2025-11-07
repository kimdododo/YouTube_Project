from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from app.core.auth import create_access_token, get_current_user_id
from app.core.responses import ok
from app.core.database import get_db
from app.schemas.user import UserCreate, UserOut
from app.schemas.user_preference import TravelPreferenceCreate, TravelPreferenceResponse
from app.crud.user import create_user, authenticate, get_by_username_or_email
from app.crud.user_preference import save_user_preferences, get_user_preferences, delete_user_preferences
from app.models.login_history import LoginHistory
import traceback

router = APIRouter(tags=["auth"])


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
        
        # 중복 체크
        existing_user = get_by_username_or_email(db, payload.username)
        if existing_user:
            print(f"[DEBUG] Username already exists: {payload.username}")
            raise HTTPException(status_code=400, detail="이미 사용 중인 사용자 이름입니다.")
        
        existing_user = get_by_username_or_email(db, payload.email)
        if existing_user:
            print(f"[DEBUG] Email already exists: {payload.email}")
            raise HTTPException(status_code=400, detail="이미 사용 중인 이메일입니다.")
        
        # 사용자 생성
        print(f"[DEBUG] Creating user: {payload.username}")
        user = create_user(db, payload.username, payload.email, payload.password)
        print(f"[DEBUG] User created successfully: id={user.id}, username={user.username}")
        return ok(UserOut.model_validate(user).model_dump()).model_dump()
    
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
    user = authenticate(db, form.username, form.password)
    if not user:
        raise HTTPException(status_code=401, detail="invalid credentials")
    
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
        save_user_preferences(db, current_user_id, payload.preference_ids)
        
        # 저장된 취향 반환
        saved_preferences = get_user_preferences(db, current_user_id)
        
        return TravelPreferenceResponse(
            user_id=current_user_id,
            preference_ids=saved_preferences
        )
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user ID")
    except Exception as e:
        print(f"[ERROR] Error saving preferences: {str(e)}")
        print(f"[ERROR] Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"취향 저장 중 오류가 발생했습니다: {str(e)}")


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
        return TravelPreferenceResponse(
            user_id=current_user_id,
            preference_ids=preferences
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
        deleted = delete_user_preferences(db, current_user_id)
        return ok({"deleted": deleted > 0}).model_dump()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user ID")
    except Exception as e:
        print(f"[ERROR] Error deleting preferences: {str(e)}")
        raise HTTPException(status_code=500, detail=f"취향 삭제 중 오류가 발생했습니다: {str(e)}")


