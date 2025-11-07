"""
Channel API 라우터
채널 관련 REST API 엔드포인트
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from app.core.database import get_db
from app.schemas.channel import ChannelResponse, ChannelListResponse
from app.crud import channel as crud_channel
from app.utils.ml_client import get_embedding, get_embeddings_batch
from app.utils.similarity import compute_similarities

router = APIRouter(prefix="/api/channels", tags=["channels"])


@router.get("/", response_model=ChannelListResponse)
def get_channels(
    skip: int = Query(0, ge=0, description="페이지네이션 오프셋"),
    limit: int = Query(10, ge=1, le=100, description="반환할 채널 수"),
    db: Session = Depends(get_db)
):
    """채널 목록 조회"""
    try:
        channels = crud_channel.get_channels(db, skip=skip, limit=limit)
        total = crud_channel.get_channels_count(db)
        
        # ChannelResponse로 변환 (이미 포맷팅된 구독자 수 사용)
        channel_responses = []
        for channel in channels:
            channel_responses.append(ChannelResponse(
                id=channel['channel_id'],
                channel_id=channel['channel_id'],
                name=channel['name'],
                subscribers=channel.get('subscribers', '0명'),
                video_count=channel['video_count'],
                total_views=channel.get('total_views', 0),
                thumbnail_url=channel.get('thumbnail_url'),
                latest_video_date=channel.get('latest_video_date')
            ))
        
        return ChannelListResponse(
            channels=channel_responses,
            total=total
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching channels: {str(e)}")


@router.get("/recommended", response_model=ChannelListResponse)
def get_recommended_channels(
    travel_preferences: Optional[str] = Query(None, description="여행 취향 ID 목록 (쉼표로 구분)"),
    limit: int = Query(4, ge=1, le=20, description="추천할 채널 수"),
    db: Session = Depends(get_db)
):
    """사용자 선호도 기반 추천 채널 조회"""
    import traceback
    try:
        print(f"[DEBUG] get_recommended_channels called with travel_preferences={travel_preferences}, limit={limit}")
        
        # travel_preferences 파싱
        pref_list = None
        if travel_preferences:
            try:
                pref_list = [int(p.strip()) for p in travel_preferences.split(',') if p.strip()]
                print(f"[DEBUG] Parsed travel preferences: {pref_list}")
            except ValueError as ve:
                print(f"[DEBUG] Failed to parse travel_preferences: {ve}")
                pref_list = None
        
        channels = crud_channel.get_recommended_channels(
            db=db,
            travel_preferences=pref_list,
            limit=limit
        )
        
        print(f"[DEBUG] get_recommended_channels returned {len(channels)} channels")
        
        # ChannelResponse로 변환
        channel_responses = []
        for channel in channels:
            try:
                channel_responses.append(ChannelResponse(
                    id=channel['channel_id'],
                    channel_id=channel['channel_id'],
                    name=channel['name'],
                    subscribers=channel.get('subscribers', '0명'),
                    video_count=channel['video_count'],
                    total_views=channel.get('total_views', 0),
                    thumbnail_url=channel.get('thumbnail_url'),
                    latest_video_date=channel.get('latest_video_date')
                ))
            except Exception as ve:
                print(f"[DEBUG] Error converting channel {channel.get('channel_id')}: {ve}")
                continue
        
        print(f"[DEBUG] Returning {len(channel_responses)} channel responses")
        return ChannelListResponse(
            channels=channel_responses,
            total=len(channel_responses)
        )
    except Exception as e:
        error_trace = traceback.format_exc()
        print(f"[ERROR] Error in get_recommended_channels: {str(e)}")
        print(f"[ERROR] Traceback: {error_trace}")
        raise HTTPException(status_code=500, detail=f"Error fetching recommended channels: {str(e)}")


@router.get("/search", response_model=ChannelListResponse)
async def search_channels(
    q: str = Query(..., min_length=1, description="검색 쿼리"),
    limit: int = Query(20, ge=1, le=100, description="반환할 채널 수"),
    use_embedding: bool = Query(True, description="임베딩 기반 유사도 검색 사용 여부"),
    db: Session = Depends(get_db)
):
    """
    채널 검색 (임베딩 기반 유사도 검색 지원)
    
    - use_embedding=True: 검색 쿼리를 임베딩으로 변환하여 채널명/설명과 유사도 계산
    - use_embedding=False: 기본 키워드 매칭 검색
    """
    try:
        # 기본 검색: 모든 채널 조회
        channels = crud_channel.get_channels(db, skip=0, limit=limit * 3)  # 더 많이 가져와서 필터링
        
        if use_embedding:
            try:
                # 1. 검색 쿼리 임베딩 변환
                query_embedding = await get_embedding(q)
                if not query_embedding:
                    # ML API 실패 시 키워드 검색으로 폴백
                    use_embedding = False
                    print(f"[WARN] ML API embedding failed, falling back to keyword search")
                
                if query_embedding:
                    # 2. 채널명 임베딩 변환 (description은 DB에서 조회하지 않으므로 채널명만 사용)
                    channel_texts = []
                    for ch in channels:
                        # 채널명 사용
                        text = ch.get('name', '') or ch.get('channel_id', '')
                        channel_texts.append(text)
                    
                    # 배치로 임베딩 변환
                    channel_embeddings = await get_embeddings_batch(channel_texts)
                    
                    if channel_embeddings and len(channel_embeddings) == len(channels):
                        # 3. 유사도 계산
                        similarities = compute_similarities(query_embedding, channel_embeddings)
                        
                        # 4. 유사도와 채널 정보 결합
                        scored_channels = [
                            {
                                **ch,
                                'similarity_score': sim
                            }
                            for ch, sim in zip(channels, similarities)
                        ]
                        
                        # 5. 유사도 순으로 정렬 (0.3 이상만)
                        scored_channels = [
                            ch for ch in scored_channels 
                            if ch.get('similarity_score', 0) >= 0.3
                        ]
                        scored_channels.sort(key=lambda x: x.get('similarity_score', 0), reverse=True)
                        
                        # 6. 상위 limit개만 반환
                        channels = scored_channels[:limit]
                        
                        print(f"[DEBUG] Embedding search found {len(channels)} channels for query '{q}'")
                    else:
                        use_embedding = False
                        print(f"[WARN] Channel embedding batch failed, falling back to keyword search")
                        
            except Exception as e:
                print(f"[WARN] Embedding search error: {e}, falling back to keyword search")
                use_embedding = False
        
        # 키워드 검색 (폴백 또는 use_embedding=False)
        if not use_embedding:
            # 채널명에 검색어가 포함된 채널만 필터링
            filtered = [
                ch for ch in channels
                if q.lower() in ch.get('name', '').lower()
            ]
            channels = filtered[:limit]
            print(f"[DEBUG] Keyword search found {len(channels)} channels for query '{q}'")
        
        # ChannelResponse로 변환
        channel_responses = []
        for channel in channels:
            try:
                # similarity_score 제거 (응답에 포함하지 않음)
                channel_dict = {k: v for k, v in channel.items() if k != 'similarity_score'}
                channel_responses.append(ChannelResponse(
                    id=channel_dict['channel_id'],
                    channel_id=channel_dict['channel_id'],
                    name=channel_dict['name'],
                    subscribers=channel_dict.get('subscribers', '0명'),
                    video_count=channel_dict['video_count'],
                    total_views=channel_dict.get('total_views', 0),
                    thumbnail_url=channel_dict.get('thumbnail_url'),
                    latest_video_date=channel_dict.get('latest_video_date')
                ))
            except Exception as ve:
                print(f"[DEBUG] Error converting channel: {ve}")
                continue
        
        return ChannelListResponse(
            channels=channel_responses,
            total=len(channel_responses)
        )
        
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        print(f"[ERROR] Error in search_channels: {str(e)}")
        print(f"[ERROR] Traceback: {error_trace}")
        raise HTTPException(status_code=500, detail=f"Error searching channels: {str(e)}")


@router.get("/{channel_id}", response_model=ChannelResponse)
def get_channel(channel_id: str, db: Session = Depends(get_db)):
    """특정 채널 정보 조회"""
    channel = crud_channel.get_channel_by_id(db, channel_id=channel_id)
    if channel is None:
        raise HTTPException(status_code=404, detail="Channel not found")
    
    # 구독자 수는 이미 포맷팅되어 있음
    return ChannelResponse(
        id=channel['channel_id'],
        channel_id=channel['channel_id'],
        name=channel['name'],
        subscribers=channel.get('subscribers', '0명'),
        video_count=channel['video_count'],
        total_views=channel.get('total_views', 0),
        thumbnail_url=channel.get('thumbnail_url'),
        latest_video_date=channel.get('latest_video_date')
    )

