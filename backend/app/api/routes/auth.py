from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from app.core.auth import create_access_token, get_current_user_id
from app.core.responses import ok
from app.core.database import get_db
from app.schemas.user import UserCreate, UserOut, PasswordChangeRequest
from app.schemas.user_preference import TravelPreferenceCreate, TravelPreferenceResponse
from app.crud.user import create_user, authenticate, get_by_username_or_email, get_by_id, update_password
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


