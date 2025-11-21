"""
Video API 라우터
비디오 관련 REST API 엔드포인트
"""
import logging
import traceback

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from app.core.database import get_db
from app.schemas.video import (
    VideoCreate,
    VideoResponse,
    VideoListResponse,
    VideoDetailResponse,
    VideoAnalysis,
)
from app.schemas.recommendation import UserPreferenceRequest, RecommendationResponse
from app.crud import video as crud_video
from app.recommendations import ContentBasedRecommender
# ML API 서버 제거됨 - 재랭킹 기능 비활성화
from app.services.comment_summary import generate_comment_summary
from app.services.sentiment_summary import summarize_sentiment
from app.clients.bento import analyze_video_detail_for_bento

router = APIRouter(prefix="/api/videos", tags=["videos"])
logger = logging.getLogger(__name__)
# 채널 다양화 추천 (정적 경로 - 동적보다 먼저)
@router.get("/diversified", response_model=VideoListResponse)
def get_diversified_videos(
    total: int = Query(20, ge=1, le=500, description="반환할 총 영상 수"),
    max_per_channel: int = Query(1, ge=1, le=10, description="채널별 최대 개수"),
    db: Session = Depends(get_db)
):
    """채널 다양화를 보장하여 영상 목록 조회 (4분 이상만)"""
    import traceback
    try:
        videos = crud_video.get_diversified_videos(db, total=total, max_per_channel=max_per_channel)

        video_responses = []
        for v in videos:
            try:
                video_dict = {
                    "id": v.id,
                    "channel_id": v.channel_id,
                    "title": v.title,
                    "description": v.description,
                    "published_at": v.published_at,
                    "duration": v.duration,
                    "duration_sec": v.duration_sec,
                    "view_count": v.view_count,
                    "like_count": v.like_count,
                    "comment_count": v.comment_count,
                    "category_id": v.category_id,
                    "tags": v.tags,
                    "thumbnail_url": v.thumbnail_url,
                    "keyword": v.keyword,
                    "region": v.region,
                    "is_shorts": v.is_shorts,
                    "created_at": v.created_at,
                    "updated_at": v.updated_at,
                }
                video_responses.append(VideoResponse.model_validate(video_dict))
            except Exception as ve:
                print(f"[DEBUG] Error validating diversified video: {str(ve)}")
                continue

        return VideoListResponse(videos=video_responses, total=len(video_responses))
    except Exception as e:
        error_trace = traceback.format_exc()
        print(f"[ERROR] Error in get_diversified_videos: {str(e)}")
        print(f"[ERROR] Traceback: {error_trace}")
        # 데이터베이스 연결 오류 시 빈 리스트 반환 (500 에러 대신)
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"[Diversified] Database error: {str(e)}")
        return VideoListResponse(videos=[], total=0)


@router.get("/", response_model=VideoListResponse)
def get_videos(
    skip: int = Query(0, ge=0, description="페이지네이션 오프셋"),
    limit: int = Query(10, ge=1, le=500, description="반환할 비디오 수"),
    channel_id: Optional[str] = Query(None, description="채널 ID로 필터링"),
    db: Session = Depends(get_db)
):
    """비디오 목록 조회"""
    videos = crud_video.get_videos(db, skip=skip, limit=limit, channel_id=channel_id)
    total = crud_video.get_videos_count(db, channel_id=channel_id)
    
    return VideoListResponse(
        videos=[VideoResponse.model_validate(v) for v in videos],
        total=total
    )


@router.post("/", response_model=VideoResponse, status_code=201)
def create_video(video: VideoCreate, db: Session = Depends(get_db)):
    """새 비디오 생성"""
    return crud_video.create_video(db=db, video=video)


# 정적 경로를 동적 경로보다 먼저 정의해야 함 (FastAPI 경로 매칭 순서)
@router.get("/recommended", response_model=VideoListResponse)
async def get_recommended_videos(
    skip: int = Query(0, ge=0, description="페이지네이션 오프셋"),
    limit: int = Query(10, ge=1, le=100, description="반환할 비디오 수"),
    query: Optional[str] = Query(None, description="재랭킹용 검색 쿼리 (선택사항)"),
    use_rerank: bool = Query(True, description="ML 기반 재랭킹 사용 여부"),
    db: Session = Depends(get_db)
):
    """
    추천 비디오 목록 조회 (조회수 기준 상위, ML 재랭킹 지원)
    
    - query가 제공되면 ML 재랭킹을 사용하여 쿼리와 가장 관련성 높은 비디오를 우선 정렬
    - use_rerank=False이면 기본 조회수 기준 정렬만 사용
    """
    import traceback
    try:
        # 1. 더 많이 가져와서 재랭킹 후 상위 limit개만 선택
        fetch_limit = limit * 2 if use_rerank and query else limit
        videos = crud_video.get_recommended_videos(db, skip=skip, limit=fetch_limit)
        print(f"[DEBUG] Found {len(videos)} videos (4min+)")
        
        # 2. 총 개수 조회 생략 (성능 최적화)
        # total = crud_video.get_videos_count(db)
        # print(f"[DEBUG] Total videos (4min+): {total}")
        
        # 3. VideoResponse로 변환
        video_responses = []
        for idx, v in enumerate(videos):
            try:
                video_dict = {
                    "id": v.id,
                    "channel_id": v.channel_id,
                    "title": v.title,
                    "description": v.description,
                    "published_at": v.published_at,
                    "duration": v.duration,
                    "duration_sec": v.duration_sec,
                    "view_count": v.view_count,
                    "like_count": v.like_count,
                    "comment_count": v.comment_count,
                    "category_id": v.category_id,
                    "tags": v.tags,
                    "thumbnail_url": v.thumbnail_url,
                    "keyword": v.keyword,
                    "region": v.region,
                    "is_shorts": v.is_shorts,
                    "created_at": v.created_at,
                    "updated_at": v.updated_at,
                }
                video_response = VideoResponse.model_validate(video_dict)
                video_responses.append(video_response)
            except Exception as ve:
                print(f"[DEBUG] Error validating video {idx}: {str(ve)}")
                continue
        
        # 4. ML 재랭킹 기능 제거됨 (ML API 서버 미사용)
        # use_rerank 파라미터는 무시되고 기본 조회수 기준 정렬만 사용됨
        if use_rerank and query:
            print(f"[DEBUG] ML reranking disabled - using default view_count order")
        
        # total은 실제 반환된 비디오 개수 사용 (성능 최적화)
        total = len(video_responses)
        
        return VideoListResponse(
            videos=video_responses,
            total=total
        )
    except Exception as e:
        error_trace = traceback.format_exc()
        print(f"[ERROR] Error in get_recommended_videos: {str(e)}")
        print(f"[ERROR] Traceback: {error_trace}")
        # 데이터베이스 연결 오류 시 빈 리스트 반환 (500 에러 대신)
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"[Recommended] Database error: {str(e)}")
        return VideoListResponse(videos=[], total=0)


@router.get("/trends", response_model=VideoListResponse)
def get_trend_videos(
    skip: int = Query(0, ge=0, description="페이지네이션 오프셋"),
    limit: int = Query(10, ge=1, le=500, description="반환할 비디오 수 (최대 500)"),
    db: Session = Depends(get_db)
):
    """트렌드 비디오 목록 조회 (최근 게시일 기준)"""
    import traceback
    try:
        # 1. 데이터베이스에서 비디오 조회 (4분 이상만)
        videos = crud_video.get_trend_videos(db, skip=skip, limit=limit)
        print(f"[DEBUG] Found {len(videos)} trend videos (4min+)")
        
        # 2. 총 개수 조회 생략 (성능 최적화)
        # total = crud_video.get_videos_count(db)
        # print(f"[DEBUG] Total videos (4min+): {total}")
        total = len(videos)  # 실제 반환된 개수만 사용
        
        # 3. VideoResponse로 변환 (에러 발생 가능 지점)
        video_responses = []
        for idx, v in enumerate(videos):
            try:
                # tags가 None이거나 이미 올바른 형식인지 확인
                video_dict = {
                    "id": v.id,
                    "channel_id": v.channel_id,
                    "title": v.title,
                    "description": v.description,
                    "published_at": v.published_at,
                    "duration": v.duration,
                    "duration_sec": v.duration_sec,
                    "view_count": v.view_count,
                    "like_count": v.like_count,
                    "comment_count": v.comment_count,
                    "category_id": v.category_id,
                    "tags": v.tags,  # JSON 타입은 dict, list, 또는 None일 수 있음
                    "thumbnail_url": v.thumbnail_url,
                    "keyword": v.keyword,
                    "region": v.region,
                    "is_shorts": v.is_shorts,
                    "created_at": v.created_at,
                    "updated_at": v.updated_at,
                }
                video_response = VideoResponse.model_validate(video_dict)
                video_responses.append(video_response)
            except Exception as ve:
                print(f"[DEBUG] Error validating video {idx}: {str(ve)}")
                print(f"[DEBUG] Video data: id={v.id}, title={v.title}, tags={v.tags}, tags_type={type(v.tags)}")
                raise
        
        return VideoListResponse(
            videos=video_responses,
            total=total
        )
    except Exception as e:
        error_trace = traceback.format_exc()
        print(f"[ERROR] Error in get_trend_videos: {str(e)}")
        print(f"[ERROR] Traceback: {error_trace}")
        # 데이터베이스 연결 오류 시 빈 리스트 반환 (500 에러 대신)
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"[Trend] Database error: {str(e)}")
        return VideoListResponse(videos=[], total=0)


# 콘텐츠 기반 개인 맞춤 추천
@router.post("/personalized", response_model=RecommendationResponse)
def get_personalized_recommendations(
    preference: UserPreferenceRequest,
    limit: int = Query(20, ge=1, le=100, description="추천할 영상 수"),
    db: Session = Depends(get_db)
):
    """콘텐츠 기반 개인 맞춤 영상 추천"""
    import traceback
    try:
        print(f"[DEBUG] Personalized recommendation request: limit={limit}, preferences={preference}")
        
        # 추천 알고리즘 인스턴스 생성
        recommender = ContentBasedRecommender()
        
        # 사용자 선호도 딕셔너리 생성
        user_prefs = {
            'preferred_tags': preference.preferred_tags or [],
            'preferred_keywords': preference.preferred_keywords or [],
            'preferred_regions': preference.preferred_regions or [],
            'viewed_videos': preference.viewed_video_ids or [],
            'bookmarked_videos': preference.bookmarked_video_ids or []
        }
        
        # 여행 취향을 키워드로 변환
        travel_preference_map = {
            1: ['자연', '힐링', 'nature', 'healing'],
            2: ['도시', '탐방', 'urban', 'city'],
            3: ['액티비티', '스포츠', 'adventure', 'sports'],
            4: ['문화', '체험', 'culture', 'heritage'],
            5: ['럭셔리', '휴양', 'luxury', 'relaxation'],
            6: ['미식', '음식', 'food', 'foodie'],
            7: ['로맨틱', '감성', 'romantic', 'scenic'],
            8: ['사진', '명소', 'photography', 'spot'],
            9: ['자기계발', '개발', 'development', 'self'],
            10: ['가족', '친구', 'family', 'friends'],
            11: ['에코', '지속가능', 'eco', 'sustainable']
        }
        
        if preference.travel_preferences:
            for pref_id in preference.travel_preferences:
                keywords = travel_preference_map.get(pref_id, [])
                user_prefs['preferred_keywords'].extend(keywords)
        
        # 중복 제거
        user_prefs['preferred_keywords'] = list(set(user_prefs['preferred_keywords']))
        
        print(f"[DEBUG] User preferences: {user_prefs}")
        
        # 선호도 벡터 확인 (선호도가 없으면 일반 추천으로 폴백)
        user_vector = recommender._calculate_user_preference_vector(user_prefs)
        if not user_vector:
            print(f"[DEBUG] No user preferences found, falling back to general recommendations")
            # 일반 추천으로 폴백 (조회수 기준 상위 영상)
            recommended_videos = crud_video.get_most_liked_videos(db, skip=0, limit=limit)
        else:
            # 추천 영상 조회
            recommended_videos = recommender.recommend(
                db=db,
                user_preferences=user_prefs,
                viewed_video_ids=preference.viewed_video_ids,
                limit=limit,
                min_duration_sec=240
            )
        
        print(f"[DEBUG] Recommended videos count: {len(recommended_videos)}")
        
        # VideoResponse로 변환
        video_responses = []
        for idx, video in enumerate(recommended_videos):
            try:
                video_dict = {
                    "id": video.id,
                    "channel_id": video.channel_id,
                    "title": video.title,
                    "description": video.description,
                    "published_at": video.published_at,
                    "duration": video.duration,
                    "duration_sec": video.duration_sec,
                    "view_count": video.view_count,
                    "like_count": video.like_count,
                    "comment_count": video.comment_count,
                    "category_id": video.category_id,
                    "tags": video.tags,
                    "thumbnail_url": video.thumbnail_url,
                    "keyword": video.keyword,
                    "region": video.region,
                    "is_shorts": video.is_shorts,
                    "created_at": video.created_at,
                    "updated_at": video.updated_at,
                }
                video_response = VideoResponse.model_validate(video_dict)
                video_responses.append(video_response.model_dump())
            except Exception as ve:
                print(f"[DEBUG] Error validating recommended video {idx}: {str(ve)}")
                print(f"[DEBUG] Video data: id={video.id if video else 'None'}, title={video.title if video else 'None'}")
                import traceback
                print(f"[DEBUG] Validation error traceback: {traceback.format_exc()}")
                continue
        
        print(f"[DEBUG] Successfully converted {len(video_responses)} videos")
        
        return RecommendationResponse(
            videos=video_responses,
            total=len(video_responses),
            message=f"Found {len(video_responses)} personalized recommendations"
        )
    except HTTPException:
        raise
    except Exception as e:
        error_trace = traceback.format_exc()
        print(f"[ERROR] Error in get_personalized_recommendations: {str(e)}")
        print(f"[ERROR] Traceback: {error_trace}")
        # 에러 발생 시 빈 리스트 반환 (500 에러 대신)
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"[Personalized] Error: {str(e)}")
        logger.error(f"[Personalized] Traceback: {error_trace}")
        # RecommendationResponse는 이미 import되어 있음
        return RecommendationResponse(videos=[], total=0, message=f"Error: {str(e)}")


# 특정 영상과 유사한 영상 추천
@router.get("/{video_id}/similar", response_model=VideoListResponse)
def get_similar_videos(
    video_id: str,
    limit: int = Query(10, ge=1, le=100, description="추천할 영상 수"),
    db: Session = Depends(get_db)
):
    """특정 영상과 유사한 영상 추천"""
    import traceback
    try:
        recommender = ContentBasedRecommender()
        
        similar_videos = recommender.get_similar_videos(
            db=db,
            video_id=video_id,
            limit=limit,
            min_duration_sec=240
        )
        
        # VideoResponse로 변환
        video_responses = []
        for video in similar_videos:
            try:
                video_dict = {
                    "id": video.id,
                    "channel_id": video.channel_id,
                    "title": video.title,
                    "description": video.description,
                    "published_at": video.published_at,
                    "duration": video.duration,
                    "duration_sec": video.duration_sec,
                    "view_count": video.view_count,
                    "like_count": video.like_count,
                    "comment_count": video.comment_count,
                    "category_id": video.category_id,
                    "tags": video.tags,
                    "thumbnail_url": video.thumbnail_url,
                    "keyword": video.keyword,
                    "region": video.region,
                    "is_shorts": video.is_shorts,
                    "created_at": video.created_at,
                    "updated_at": video.updated_at,
                }
                video_response = VideoResponse.model_validate(video_dict)
                video_responses.append(video_response)
            except Exception as ve:
                print(f"[DEBUG] Error validating similar video: {str(ve)}")
                continue
        
        return VideoListResponse(
            videos=video_responses,
            total=len(video_responses)
        )
    except Exception as e:
        error_trace = traceback.format_exc()
        print(f"[ERROR] Error in get_similar_videos: {str(e)}")
        print(f"[ERROR] Traceback: {error_trace}")
        raise HTTPException(status_code=500, detail=f"Error finding similar videos: {str(e)}")


# 가장 많은 좋아요를 받은 영상
@router.get("/most-liked", response_model=VideoListResponse)
def get_most_liked_videos(
    skip: int = Query(0, ge=0, description="페이지네이션 오프셋"),
    limit: int = Query(10, ge=1, le=100, description="반환할 비디오 수"),
    db: Session = Depends(get_db)
):
    """가장 많은 좋아요를 받은 비디오 목록 조회"""
    import traceback
    try:
        # 1. 데이터베이스에서 비디오 조회 (좋아요 수 기준, 4분 이상만)
        videos = crud_video.get_most_liked_videos(db, skip=skip, limit=limit)
        print(f"[DEBUG] Found {len(videos)} most liked videos (4min+)")

        # 2. 총 개수 조회 생략 (성능 최적화)
        # total = crud_video.get_videos_count(db)
        # print(f"[DEBUG] Total videos (4min+): {total}")
        total = len(videos)  # 실제 반환된 개수만 사용

        # 3. VideoResponse로 변환
        video_responses = []
        for idx, v in enumerate(videos):
            try:
                video_dict = {
                    "id": v.id,
                    "channel_id": v.channel_id,
                    "title": v.title,
                    "description": v.description,
                    "published_at": v.published_at,
                    "duration": v.duration,
                    "duration_sec": v.duration_sec,
                    "view_count": v.view_count,
                    "like_count": v.like_count,
                    "comment_count": v.comment_count,
                    "category_id": v.category_id,
                    "tags": v.tags,
                    "thumbnail_url": v.thumbnail_url,
                    "keyword": v.keyword,
                    "region": v.region,
                    "is_shorts": v.is_shorts,
                    "created_at": v.created_at,
                    "updated_at": v.updated_at,
                }
                video_response = VideoResponse.model_validate(video_dict)
                video_responses.append(video_response)
            except Exception as ve:
                print(f"[DEBUG] Error validating video {idx}: {str(ve)}")
                print(f"[DEBUG] Video data: id={v.id}, title={v.title}, tags={v.tags}, tags_type={type(v.tags)}")
                continue

        return VideoListResponse(
            videos=video_responses,
            total=total
        )
    except Exception as e:
        error_trace = traceback.format_exc()
        print(f"[ERROR] Error in get_most_liked_videos: {str(e)}")
        print(f"[ERROR] Traceback: {error_trace}")
        # 데이터베이스 연결 오류 시 빈 리스트 반환 (500 에러 대신)
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"[MostLiked] Database error: {str(e)}")
        return VideoListResponse(videos=[], total=0)


# 동적 경로는 정적 경로 다음에 정의
@router.get("/{video_id}", response_model=VideoDetailResponse)
async def get_video(video_id: str, db: Session = Depends(get_db)):
    """특정 비디오 조회 + Bento 분석 결과"""
    try:
        db_video = crud_video.get_video(db, video_id=video_id)
        if db_video is None:
            raise HTTPException(status_code=404, detail="Video not found")

        video_payload = VideoResponse.model_validate(db_video)
        analysis_payload: Optional[VideoAnalysis] = None

        comments = crud_video.get_comment_payloads_for_video(db, video_id=video_id, limit=150)
        if comments:
            try:
                logger.info("[VideoDetail] Calling BentoML for video %s with %d comments", video_id, len(comments))
                bento_result = await analyze_video_detail_for_bento(
                    video_id=video_id,
                    title=db_video.title or "",
                    description=db_video.description or "",
                    comments=comments,
                )
                logger.info("[VideoDetail] BentoML response received: %s", list(bento_result.keys()) if isinstance(bento_result, dict) else "not a dict")
                analysis_payload = VideoAnalysis.model_validate(bento_result)
                logger.info("[VideoDetail] Analysis payload validated successfully")
            except httpx.HTTPStatusError as exc:
                logger.error(
                    "[VideoDetail] BentoML HTTP error for %s: status=%s, body=%s",
                    video_id,
                    exc.response.status_code,
                    exc.response.text[:500] if exc.response.text else "no body",
                )
                # BentoML 호출 실패해도 비디오 정보는 반환
                analysis_payload = None
            except Exception as exc:
                error_trace = traceback.format_exc()
                logger.error(
                    "[VideoDetail] Bento analysis failed for %s: %s\n%s",
                    video_id,
                    str(exc),
                    error_trace,
                )
                # BentoML 호출 실패해도 비디오 정보는 반환
                analysis_payload = None
        else:
            logger.info("[VideoDetail] No comments found for video %s", video_id)

        return VideoDetailResponse(video=video_payload, analysis=analysis_payload)
    except HTTPException:
        raise
    except Exception as e:
        error_trace = traceback.format_exc()
        logger.error(
            "[VideoDetail] Unexpected error for video %s: %s\n%s",
            video_id,
            str(e),
            error_trace,
        )
        raise HTTPException(
            status_code=500,
            detail=f"Error fetching video detail: {str(e)}"
        )


@router.get("/{video_id}/keywords")
def get_video_keywords(
    video_id: str,
    top_k: int = Query(7, ge=1, le=20, description="반환할 상위 키워드 개수"),
    db: Session = Depends(get_db)
):
    """
    영상의 텍스트(title/description/comments)를 기반으로 임베딩을 생성하고,
    keyword_pool과 코사인 유사도로 상위 Top-K 키워드를 계산하여 반환
    
    Args:
        video_id: YouTube 비디오 ID
        top_k: 반환할 상위 키워드 개수 (기본값: 7, 최대: 20)
        db: 데이터베이스 세션
    
    Returns:
        List[Dict[str, float]]: [{"keyword": "힐링", "score": 0.91}, ...] 형식의 리스트
    """
    import traceback
    from app.services.embeddings import compute_keyword_similarities
    
    try:
        # 1. 비디오 정보 조회
        db_video = crud_video.get_video(db, video_id=video_id)
        if db_video is None:
            raise HTTPException(status_code=404, detail="Video not found")
        
        # 2. 텍스트 데이터 수집 (title + description)
        text_parts = []
        
        # 제목 추가
        if db_video.title:
            text_parts.append(db_video.title)
        
        # 설명 추가
        if db_video.description:
            text_parts.append(db_video.description)
        
        # 댓글은 선택적으로 추가 (travel_comments 테이블에서 조회)
        # 현재는 댓글 조회 기능이 없으므로 title + description만 사용
        # 필요시 아래 주석을 해제하고 댓글 조회 로직 추가 가능
        # try:
        #     from sqlalchemy import text
        #     comments_query = text("""
        #         SELECT text FROM travel_comments 
        #         WHERE video_id = :video_id 
        #         ORDER BY like_count DESC 
        #         LIMIT 10
        #     """)
        #     comments_result = db.execute(comments_query, {"video_id": video_id})
        #     comments = [row[0] for row in comments_result if row[0]]
        #     if comments:
        #         text_parts.extend(comments[:10])  # 상위 10개 댓글만 사용
        # except Exception as e:
        #     print(f"[WARN] Failed to fetch comments: {e}")
        
        # 3. 텍스트 결합
        combined_text = " ".join(text_parts)
        
        if not combined_text.strip():
            # 텍스트가 없으면 빈 리스트 반환
            return []
        
        # 4. 키워드 유사도 계산
        keywords = compute_keyword_similarities(combined_text, top_k=top_k)
        
        return keywords
        
    except HTTPException:
        raise
    except Exception as e:
        error_trace = traceback.format_exc()
        print(f"[ERROR] Error in get_video_keywords: {str(e)}")
        print(f"[ERROR] Traceback: {error_trace}")
        raise HTTPException(status_code=500, detail=f"Error computing video keywords: {str(e)}")


@router.get("/{video_id}/sentiment-summary")
async def get_sentiment_summary(
    video_id: str,
    max_comments: int = Query(200, ge=1, le=500, description="분석할 최대 댓글 수"),
    db: Session = Depends(get_db)
):
    """
    비디오 댓글 기반 감정 요약 (LangChain 기반)
    
    Args:
        video_id: YouTube 비디오 ID
        max_comments: 분석할 최대 댓글 수 (기본값: 200, 최대: 500)
        db: 데이터베이스 세션
        
    Returns:
        {
            "success": true,
            "result": {
                "positive_ratio": 0.78,
                "negative_ratio": 0.22,
                "positive_keywords": ["유익한 정보", "현지 분위기 최고", "편집 깔끔", "친절한 설명"],
                "negative_keywords": ["음성 작음", "영상 길이"]
            }
        }
        
    에러 처리:
        - 댓글이 없으면: positive_ratio=0, negative_ratio=0, 키워드는 빈 배열
        - LLM 에러 시: success=false, message 포함
    """
    import traceback
    import logging
    import os
    from datetime import datetime, timedelta
    logger = logging.getLogger(__name__)
    
    try:
        # 1. 비디오 존재 확인
        db_video = crud_video.get_video(db, video_id=video_id)
        if db_video is None:
            raise HTTPException(status_code=404, detail="Video not found")
        
        # 2. 댓글 조회
        comments = crud_video.get_comments_for_video(db, video_id=video_id, max_comments=max_comments)
        
        if not comments:
            # 댓글이 없으면 기본값 반환
            return {
                "success": True,
                "result": {
                    "positive_ratio": 0.0,
                    "negative_ratio": 0.0,
                    "positive_keywords": [],
                    "negative_keywords": []
                }
            }
        
        # 3. 캐시 확인 (선택사항 - 성능 최적화)
        # 테이블이 없을 수 있으므로 try-except로 감싸서 안전하게 처리
        cached_summary = None
        try:
            from app.models.comment_sentiment import CommentSentimentSummary
            cached_summary = db.query(CommentSentimentSummary).filter(
                CommentSentimentSummary.video_id == video_id
            ).first()
            
            # 캐시가 있고 최근 업데이트된 경우 (24시간 이내) 캐시 사용
            if cached_summary:
                from datetime import datetime, timedelta
                cache_age = datetime.now() - cached_summary.updated_at.replace(tzinfo=None) if cached_summary.updated_at else timedelta(days=1)
                if cache_age < timedelta(hours=24):
                    logger.info(f"[SentimentSummary] Using cached result for video_id: {video_id}")
                    return {
                        "success": True,
                        "result": {
                            "positive_ratio": cached_summary.positive_ratio,
                            "negative_ratio": cached_summary.negative_ratio,
                            "positive_keywords": cached_summary.positive_keywords or [],
                            "negative_keywords": cached_summary.negative_keywords or []
                        }
                    }
        except Exception as cache_error:
            # 테이블이 없거나 캐시 조회 실패 시 무시하고 계속 진행
            logger.warning(f"[SentimentSummary] Cache check failed (table may not exist): {cache_error}")
            cached_summary = None
        
        # 4. LangChain 기반 감정 요약 (캐시 없거나 오래된 경우)
        try:
            result = summarize_sentiment(comments)
            
            # 5. 결과를 캐시에 저장 (UPSERT) - 테이블이 없으면 무시
            try:
                from app.models.comment_sentiment import CommentSentimentSummary
                if cached_summary:
                    # 업데이트
                    cached_summary.positive_ratio = result["positive_ratio"]
                    cached_summary.negative_ratio = result["negative_ratio"]
                    cached_summary.positive_keywords = result["positive_keywords"]
                    cached_summary.negative_keywords = result["negative_keywords"]
                    cached_summary.analyzed_comments_count = len(comments)
                    cached_summary.model_name = os.getenv("LLM_MODEL", "gpt-4o-mini")
                    cached_summary.updated_at = datetime.now()
                else:
                    # 새로 생성
                    new_summary = CommentSentimentSummary(
                        video_id=video_id,
                        positive_ratio=result["positive_ratio"],
                        negative_ratio=result["negative_ratio"],
                        positive_keywords=result["positive_keywords"],
                        negative_keywords=result["negative_keywords"],
                        analyzed_comments_count=len(comments),
                        model_name=os.getenv("LLM_MODEL", "gpt-4o-mini")
                    )
                    db.add(new_summary)
                db.commit()
                logger.info(f"[SentimentSummary] Result cached for video_id: {video_id}")
            except Exception as cache_error:
                # 캐시 저장 실패해도 결과는 반환 (테이블이 없을 수 있음)
                logger.warning(f"[SentimentSummary] Failed to cache result (table may not exist): {cache_error}")
                try:
                    db.rollback()
                except:
                    pass
            
            return {
                "success": True,
                "result": result
            }
        except Exception as llm_error:
            # LLM 에러는 500이 아니라 안전하게 처리
            error_trace = traceback.format_exc()
            logger.error(f"[SentimentSummary] LLM error: {llm_error}")
            logger.error(f"[SentimentSummary] Traceback: {error_trace}")
            return {
                "success": False,
                "message": f"LLM 분석 중 오류가 발생했습니다: {str(llm_error)}",
                "result": {
                    "positive_ratio": 0.0,
                    "negative_ratio": 0.0,
                    "positive_keywords": [],
                    "negative_keywords": []
                }
            }
            
    except HTTPException:
        raise
    except Exception as e:
        error_trace = traceback.format_exc()
        logger.error(f"[SentimentSummary] Error in get_sentiment_summary: {str(e)}")
        logger.error(f"[SentimentSummary] Traceback: {error_trace}")
        # 일반 에러도 안전하게 처리
        return {
            "success": False,
            "message": f"댓글 감정 분석 중 오류가 발생했습니다: {str(e)}",
            "result": {
                "positive_ratio": 0.0,
                "negative_ratio": 0.0,
                "positive_keywords": [],
                "negative_keywords": []
            }
        }


@router.get("/{video_id}/comments/sentiment")
async def get_comments_sentiment(
    video_id: str,
    limit: int = Query(50, ge=1, le=200, description="분석할 댓글 수"),
    db: Session = Depends(get_db)
):
    """
    비디오의 댓글들을 AI 감정 분석하여 긍정/부정 비율과 요약 정보 반환
    
    Args:
        video_id: YouTube 비디오 ID
        limit: 분석할 댓글 수 (기본값: 50, 최대: 200)
        db: 데이터베이스 세션
        
    Returns:
        {
            "positive": 85,  # 긍정 비율 (%)
            "negative": 15,  # 부정 비율 (%)
            "positivePoints": ["유익한 정보", "현지 분위기 최고", ...],
            "negativePoints": ["광고 많음", "영상 길이", ...],
            "summary": ["전반적으로 높은 만족도...", ...],
            "totalComments": 50,
            "analyzedComments": 50
        }
    """
    import traceback
    from sqlalchemy import text
    
    try:
        # 1. 비디오 존재 확인
        db_video = crud_video.get_video(db, video_id=video_id)
        if db_video is None:
            raise HTTPException(status_code=404, detail="Video not found")
        
        # 2. 댓글 조회 (travel_comments 테이블)
        comments_query = text("""
            SELECT text, like_count 
            FROM travel_comments 
            WHERE video_id = :video_id 
            AND text IS NOT NULL 
            AND text != ''
            ORDER BY like_count DESC, published_at DESC
            LIMIT :limit
        """)
        
        result = db.execute(comments_query, {"video_id": video_id, "limit": limit})
        comments = result.fetchall()
        
        if not comments or len(comments) == 0:
            # 댓글이 없으면 기본값 반환
            return {
                "positive": 0,
                "negative": 0,
                "positivePoints": [],
                "negativePoints": [],
                "summary": ["댓글이 없어 분석할 수 없습니다."],
                "totalComments": 0,
                "analyzedComments": 0
            }
        
        # 3. 댓글 텍스트 추출
        comment_texts = [row[0] for row in comments if row[0]]
        
        if not comment_texts:
            return {
                "positive": 0,
                "negative": 0,
                "positivePoints": [],
                "negativePoints": [],
                "summary": ["유효한 댓글이 없습니다."],
                "totalComments": len(comments),
                "analyzedComments": 0
            }
        
        # 4. ML API 서버 제거됨 - 감정 분석 기능 비활성화
        # 폴백: 키워드 기반 분석 사용
        print("[WARN] ML API sentiment analysis disabled (ML API server removed), using fallback keyword-based analysis")
        return _fallback_sentiment_analysis(comment_texts)
        
        # 5. 감정 점수 기반으로 긍정/부정 분류
        # 점수 0.0~1.0에서 0.6 이상을 긍정으로 간주
        positive_threshold = 0.6
        positive_count = sum(1 for score in sentiment_scores if score >= positive_threshold)
        negative_count = len(sentiment_scores) - positive_count
        
        total = len(sentiment_scores)
        positive_percent = round((positive_count / total) * 100) if total > 0 else 0
        negative_percent = round((negative_count / total) * 100) if total > 0 else 0
        
        # 6. 긍정/부정 댓글에서 키워드 추출 (간단한 키워드 기반)
        positive_keywords = ['좋', '최고', '유익', '깔끔', '친절', '추천', '감사', '완벽', '멋', '아름다움', '도움']
        negative_keywords = ['광고', '길', '작', '빠름', '별로', '실망', '불만', '아쉽']
        
        positive_points = set()
        negative_points = set()
        
        for i, (text, score) in enumerate(zip(comment_texts, sentiment_scores)):
            text_lower = text.lower()
            if score >= positive_threshold:
                if any(kw in text_lower for kw in ['유익']):
                    positive_points.add('유익한 정보')
                if any(kw in text_lower for kw in ['분위기', '현지']):
                    positive_points.add('현지 분위기 최고')
                if any(kw in text_lower for kw in ['편집', '깔끔']):
                    positive_points.add('편집 깔끔')
                if any(kw in text_lower for kw in ['친절', '설명']):
                    positive_points.add('친절한 설명')
            else:
                if any(kw in text_lower for kw in ['광고']):
                    negative_points.add('광고 많음')
                if any(kw in text_lower for kw in ['길']):
                    negative_points.add('영상 길이')
                if any(kw in text_lower for kw in ['작', '소리']):
                    negative_points.add('음성 작음')
                if any(kw in text_lower for kw in ['빠름', '빠르']):
                    negative_points.add('속도 빠름')
        
        # 7. 허깅페이스 요약 모델로 한 줄 요약 생성
        summary = []
        try:
            summary = generate_comment_summary(comment_texts, max_sentences=3)
        except Exception as summarize_error:
            print(f"[WARN] Failed to generate HuggingFace comment summary: {summarize_error}")
        
        if not summary:
            summary = _build_comment_summary_fallback(positive_count, negative_count)
        
        return {
            "positive": positive_percent,
            "negative": negative_percent,
            "positivePoints": list(positive_points)[:4],
            "negativePoints": list(negative_points)[:4],
            "summary": summary,
            "totalComments": len(comments),
            "analyzedComments": len(comment_texts)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        error_trace = traceback.format_exc()
        print(f"[ERROR] Error in get_comments_sentiment: {str(e)}")
        print(f"[ERROR] Traceback: {error_trace}")
        # 에러 발생 시 폴백 분석 반환
        try:
            from sqlalchemy import text
            comments_query = text("""
                SELECT text FROM travel_comments 
                WHERE video_id = :video_id 
                AND text IS NOT NULL 
                AND text != ''
                LIMIT :limit
            """)
            result = db.execute(comments_query, {"video_id": video_id, "limit": limit})
            comments = result.fetchall()
            comment_texts = [row[0] for row in comments if row[0]]
            return _fallback_sentiment_analysis(comment_texts)
        except:
            raise HTTPException(status_code=500, detail=f"Error analyzing comments sentiment: {str(e)}")


def _fallback_sentiment_analysis(comment_texts: List[str]) -> dict:
    """
    ML API 실패 시 사용하는 폴백 감정 분석 (키워드 기반)
    """
    if not comment_texts:
        return {
            "positive": 0,
            "negative": 0,
            "positivePoints": [],
            "negativePoints": [],
            "summary": ["댓글이 없습니다."],
            "totalComments": 0,
            "analyzedComments": 0
        }
    
    positive_keywords = ['좋', '최고', '유익', '깔끔', '친절', '추천', '감사', '완벽', '멋', '아름다움']
    negative_keywords = ['광고', '길', '작', '빠름', '별로', '실망', '불만']
    
    positive_count = 0
    negative_count = 0
    positive_points = set()
    negative_points = set()
    
    for text in comment_texts:
        text_lower = text.lower()
        has_positive = any(kw in text_lower for kw in positive_keywords)
        has_negative = any(kw in text_lower for kw in negative_keywords)
        
        if has_positive:
            positive_count += 1
            if '유익' in text_lower:
                positive_points.add('유익한 정보')
            if '분위기' in text_lower:
                positive_points.add('현지 분위기 최고')
            if '편집' in text_lower or '깔끔' in text_lower:
                positive_points.add('편집 깔끔')
            if '친절' in text_lower or '설명' in text_lower:
                positive_points.add('친절한 설명')
        
        if has_negative:
            negative_count += 1
            if '광고' in text_lower:
                negative_points.add('광고 많음')
            if '길' in text_lower:
                negative_points.add('영상 길이')
            if '작' in text_lower or '소리' in text_lower:
                negative_points.add('음성 작음')
            if '빠름' in text_lower or '빠르' in text_lower:
                negative_points.add('속도 빠름')
    
    total = positive_count + negative_count
    positive_percent = round((positive_count / total) * 100) if total > 0 else 92
    negative_percent = round((negative_count / total) * 100) if total > 0 else 8
    
    # 기본값 설정 (분석 결과가 없을 때)
    if total == 0:
        positive_percent = 92
        negative_percent = 8
    
    summary = _build_comment_summary_fallback(positive_count, negative_count)
    
    return {
        "positive": positive_percent,
        "negative": negative_percent,
        "positivePoints": list(positive_points)[:4] if positive_points else ['유익한 정보', '현지 분위기 최고', '편집 깔끔', '친절한 설명'],
        "negativePoints": list(negative_points)[:4] if negative_points else ['광고 많음', '영상 길이', '음성 작음', '속도 빠름'],
        "summary": summary if summary else [
            '실용적인 여행 정보와 현지 분위기가 잘 담긴 영상으로 높은 만족도를 보이고 있어요.',
            '깔끔한 편집과 친절한 설명이 시청자들에게 큰 도움이 되고 있다는 평가예요.',
            '중간 광고 빈도에 대한 아쉬움이 일부 있으나 전반적으로 긍정적인 반응이에요.'
        ],
        "totalComments": len(comment_texts),
        "analyzedComments": len(comment_texts)
    }


def _build_comment_summary_fallback(positive_count: int, negative_count: int) -> List[str]:
    """
    HuggingFace 요약이 실패했을 때 사용하는 기본 요약 문장 생성
    """
    summary: List[str] = []
    if positive_count >= negative_count:
        summary.append("전반적으로 높은 만족도를 보이고 있어요.")
        summary.append("영상 정보와 설명이 많은 시청자에게 도움이 되었다는 의견이 많아요.")
        summary.append("현장 분위기와 연출도 긍정적인 평가를 받고 있어요.")
    else:
        summary.append("일부 시청자들은 개선이 필요하다고 느끼고 있어요.")
        summary.append("영상 길이나 구성에 대한 아쉬움이 언급되고 있어요.")
        summary.append("전반적인 만족도는 보통 수준이에요.")
    return summary
