"""
Video API 라우터
비디오 관련 REST API 엔드포인트
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from app.core.database import get_db
from app.schemas.video import VideoCreate, VideoResponse, VideoListResponse
from app.schemas.recommendation import UserPreferenceRequest, RecommendationResponse
from app.crud import video as crud_video
from app.recommendations import ContentBasedRecommender
from app.utils.ml_client import rerank_videos

router = APIRouter(prefix="/api/videos", tags=["videos"])
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
        raise HTTPException(status_code=500, detail=f"Error fetching diversified videos: {str(e)}")


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
        
        # 2. 총 개수 조회 (4분 이상만)
        total = crud_video.get_videos_count(db)
        print(f"[DEBUG] Total videos (4min+): {total}")
        
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
        
        # 4. ML 재랭킹 적용 (query가 제공되고 use_rerank=True인 경우)
        if use_rerank and query and video_responses:
            try:
                # 재랭킹용 후보 리스트 생성 (제목 + 키워드)
                candidates = [
                    {
                        "id": vid.id,
                        "text": f"{vid.title} {vid.keyword or ''} {vid.region or ''}".strip()
                    }
                    for vid in video_responses
                ]
                
                # 재랭킹 실행
                reranked = await rerank_videos(query, candidates)
                
                if reranked and len(reranked) == len(video_responses):
                    # 재랭킹 결과를 점수 기준으로 정렬
                    video_score_map = {item["id"]: item["score"] for item in reranked}
                    
                    # 비디오에 점수 추가 및 정렬
                    for vid in video_responses:
                        vid._rerank_score = video_score_map.get(vid.id, 0.0)
                    
                    # 재랭킹 점수 순으로 정렬
                    video_responses.sort(key=lambda x: getattr(x, '_rerank_score', 0.0), reverse=True)
                    
                    # 상위 limit개만 선택
                    video_responses = video_responses[:limit]
                    
                    print(f"[DEBUG] Reranked {len(video_responses)} videos for query '{query}'")
                else:
                    print(f"[WARN] Reranking failed, using original order")
            except Exception as rerank_error:
                print(f"[WARN] Reranking error: {rerank_error}, using original order")
        
        return VideoListResponse(
            videos=video_responses,
            total=total
        )
    except Exception as e:
        error_trace = traceback.format_exc()
        print(f"[ERROR] Error in get_recommended_videos: {str(e)}")
        print(f"[ERROR] Traceback: {error_trace}")
        raise HTTPException(status_code=500, detail=f"Error fetching recommended videos: {str(e)}")


@router.get("/trends", response_model=VideoListResponse)
def get_trend_videos(
    skip: int = Query(0, ge=0, description="페이지네이션 오프셋"),
    limit: int = Query(10, ge=1, le=100, description="반환할 비디오 수"),
    db: Session = Depends(get_db)
):
    """트렌드 비디오 목록 조회 (최근 게시일 기준)"""
    import traceback
    try:
        # 1. 데이터베이스에서 비디오 조회 (4분 이상만)
        videos = crud_video.get_trend_videos(db, skip=skip, limit=limit)
        print(f"[DEBUG] Found {len(videos)} trend videos (4min+)")
        
        # 2. 총 개수 조회 (4분 이상만)
        total = crud_video.get_videos_count(db)
        print(f"[DEBUG] Total videos (4min+): {total}")
        
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
        raise HTTPException(status_code=500, detail=f"Error fetching trend videos: {str(e)}")


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
        
        # 추천 영상 조회
        recommended_videos = recommender.recommend(
            db=db,
            user_preferences=user_prefs,
            viewed_video_ids=preference.viewed_video_ids,
            limit=limit,
            min_duration_sec=240
        )
        
        # VideoResponse로 변환
        video_responses = []
        for video in recommended_videos:
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
                print(f"[DEBUG] Error validating recommended video: {str(ve)}")
                continue
        
        return RecommendationResponse(
            videos=video_responses,
            total=len(video_responses),
            message=f"Found {len(video_responses)} personalized recommendations"
        )
    except Exception as e:
        error_trace = traceback.format_exc()
        print(f"[ERROR] Error in get_personalized_recommendations: {str(e)}")
        print(f"[ERROR] Traceback: {error_trace}")
        raise HTTPException(status_code=500, detail=f"Error generating recommendations: {str(e)}")


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

        # 2. 총 개수 조회 (4분 이상만)
        total = crud_video.get_videos_count(db)
        print(f"[DEBUG] Total videos (4min+): {total}")

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
        raise HTTPException(status_code=500, detail=f"Error fetching most liked videos: {str(e)}")


# 동적 경로는 정적 경로 다음에 정의
@router.get("/{video_id}", response_model=VideoResponse)
def get_video(video_id: str, db: Session = Depends(get_db)):
    """특정 비디오 조회 (video_id는 YouTube 비디오 ID 문자열)"""
    db_video = crud_video.get_video(db, video_id=video_id)
    if db_video is None:
        raise HTTPException(status_code=404, detail="Video not found")
    return VideoResponse.model_validate(db_video)

