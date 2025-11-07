"""
Channel CRUD 작업
채널 관련 데이터베이스 연산을 정의합니다.
"""
from sqlalchemy.orm import Session
from sqlalchemy import desc, func, distinct, or_, outerjoin
from sqlalchemy.sql import select
from typing import List, Optional
from app.models.video import Video
from app.models.channel import Channel


def get_channels(
    db: Session,
    skip: int = 0,
    limit: int = 10
) -> List[dict]:
    """
    채널 목록 조회 (비디오가 있는 채널만, 영상 수 기준 정렬)
    travel_channels 테이블과 조인하여 실제 채널 정보 사용
    Returns:
        List of dict with channel_id, channel_name, video_count, subscriber_count, thumbnail_url
    """
    # travel_channels와 travel_videos를 조인하여 실제 채널 정보 가져오기
    # 4분 이상 영상이 있는 채널만 조회
    query = db.query(
        Channel.id.label('channel_id'),
        Channel.title.label('channel_name'),
        Channel.subscriber_count,
        Channel.video_count.label('channel_video_count'),
        Channel.thumbnail_url.label('channel_thumbnail_url'),
        func.count(Video.id).label('video_count'),  # 실제 DB에 있는 영상 수
        func.max(Video.published_at).label('latest_video_date'),
        func.sum(Video.view_count).label('total_views')
    ).join(
        Video, 
        (Channel.id == Video.channel_id) & (Video.duration_sec >= 240)
    ).group_by(
        Channel.id,
        Channel.title,
        Channel.subscriber_count,
        Channel.video_count,
        Channel.thumbnail_url
    ).order_by(
        desc('video_count'),  # 영상 수가 많은 순서
        desc('total_views')  # 총 조회수 순서
    ).offset(skip).limit(limit)
    
    results = query.all()
    
    # 딕셔너리로 변환
    channels = []
    for result in results:
        # 실제 채널명 사용 (travel_channels.title)
        channel_name = result.channel_name
        if not channel_name:
            # travel_channels에 없으면 채널 ID 사용
            channel_name = f"Channel {result.channel_id[-8:]}"
        
        # 실제 구독자 수 사용 (travel_channels.subscriber_count)
        subscriber_count = result.subscriber_count or 0
        
        # 실제 영상 수 사용 (travel_channels.video_count 또는 계산된 video_count 중 큰 값)
        video_count = max(result.video_count or 0, result.channel_video_count or 0)
        
        # 구독자 수 포맷팅
        if subscriber_count >= 1000000:
            subscribers = f"{subscriber_count // 10000}만명"
        elif subscriber_count >= 10000:
            subscribers = f"{subscriber_count // 1000}천명"
        else:
            subscribers = f"{subscriber_count:,}명"
        
        channels.append({
            'id': result.channel_id,
            'channel_id': result.channel_id,
            'name': channel_name,
            'subscribers': subscribers,
            'subscriber_count': subscriber_count,
            'video_count': video_count,
            'total_views': result.total_views or 0,
            'thumbnail_url': result.channel_thumbnail_url or None,
            'latest_video_date': result.latest_video_date
        })
    
    return channels


def get_channels_count(db: Session) -> int:
    """채널 총 개수 조회 (4분 이상 영상이 있는 채널만, travel_channels와 조인)"""
    return db.query(
        func.count(distinct(Channel.id))
    ).join(
        Video,
        (Channel.id == Video.channel_id) & (Video.duration_sec >= 240)
    ).scalar()


def get_channel_by_id(db: Session, channel_id: str) -> Optional[dict]:
    """특정 채널 정보 조회 (travel_channels 테이블 사용)"""
    # travel_channels에서 채널 정보 조회
    channel = db.query(Channel).filter(Channel.id == channel_id).first()
    
    if not channel:
        return None
    
    # 비디오 통계 정보 조회
    video_stats = db.query(
        func.count(Video.id).label('video_count'),
        func.max(Video.published_at).label('latest_video_date'),
        func.sum(Video.view_count).label('total_views')
    ).filter(
        Video.channel_id == channel_id,
        Video.duration_sec >= 240
    ).first()
    
    # 실제 채널명 사용
    channel_name = channel.title or f"Channel {channel_id[-8:]}"
    
    # 실제 구독자 수 사용
    subscriber_count = channel.subscriber_count or 0
    
    # 실제 영상 수 사용 (travel_channels.video_count 또는 계산된 video_count 중 큰 값)
    video_count = max(video_stats.video_count or 0, channel.video_count or 0)
    
    # 구독자 수 포맷팅
    if subscriber_count >= 1000000:
        subscribers = f"{subscriber_count // 10000}만명"
    elif subscriber_count >= 10000:
        subscribers = f"{subscriber_count // 1000}천명"
    else:
        subscribers = f"{subscriber_count:,}명"
    
    return {
        'id': channel.id,
        'channel_id': channel.id,
        'name': channel_name,
        'subscribers': subscribers,
        'subscriber_count': subscriber_count,
        'video_count': video_count,
        'total_views': video_stats.total_views or 0,
        'thumbnail_url': channel.thumbnail_url,
        'latest_video_date': video_stats.latest_video_date
    }


def get_recommended_channels(
    db: Session,
    travel_preferences: Optional[List[int]] = None,
    limit: int = 4
) -> List[dict]:
    """
    사용자 선호도 기반 추천 채널 조회
    travel_channels 테이블과 조인하여 실제 채널 정보 사용
    Args:
        db: Database session
        travel_preferences: 여행 취향 ID 목록
        limit: 추천할 채널 수
    Returns:
        List of recommended channels
    """
    # 기본 쿼리: travel_channels와 조인하여 실제 채널 정보 가져오기
    # 4분 이상 영상이 있는 채널만 조회
    base_query = db.query(
        Channel.id.label('channel_id'),
        Channel.title.label('channel_name'),
        Channel.subscriber_count,
        Channel.video_count.label('channel_video_count'),
        Channel.thumbnail_url.label('channel_thumbnail_url'),
        func.count(Video.id).label('video_count'),
        func.max(Video.published_at).label('latest_video_date'),
        func.sum(Video.view_count).label('total_views'),
        func.max(Video.keyword).label('keyword'),
        func.max(Video.region).label('region')
    ).join(
        Video,
        (Channel.id == Video.channel_id) & (Video.duration_sec >= 240)
    ).group_by(
        Channel.id,
        Channel.title,
        Channel.subscriber_count,
        Channel.video_count,
        Channel.thumbnail_url
    )
    
    # 여행 취향이 있으면 키워드나 지역으로 필터링 시도
    filtered_results = []
    if travel_preferences:
        # 여행 취향 매핑
        preference_keywords = {
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
        
        # 선호 키워드 수집
        preferred_keywords = []
        for pref_id in travel_preferences:
            keywords = preference_keywords.get(pref_id, [])
            preferred_keywords.extend(keywords)
        
        # 키워드나 지역이 선호 키워드를 포함하는 채널 필터링 시도
        if preferred_keywords:
            conditions = []
            for keyword in preferred_keywords:
                conditions.append(Video.keyword.like(f'%{keyword}%'))
                conditions.append(Video.region.like(f'%{keyword}%'))
            
            if conditions:
                filtered_query = base_query.filter(or_(*conditions))
                filtered_query = filtered_query.order_by(
                    desc('video_count'),
                    desc('total_views')
                ).limit(limit)
                
                filtered_results = filtered_query.all()
                print(f"[DEBUG] Found {len(filtered_results)} channels after preference filtering")
    
    # 필터링 결과가 없거나 여행 취향이 없으면 전체 채널 반환
    if not filtered_results:
        print(f"[DEBUG] No filtered results, returning top channels")
        query = base_query.order_by(
            desc('video_count'),
            desc('total_views')
        ).limit(limit)
        
        results = query.all()
        print(f"[DEBUG] Found {len(results)} total channels")
    else:
        results = filtered_results
    
    # 딕셔너리로 변환
    channels = []
    for result in results:
        # 실제 채널명 사용 (travel_channels.title)
        channel_name = result.channel_name
        if not channel_name:
            # travel_channels에 없으면 채널 ID 사용
            channel_name = f"Channel {result.channel_id[-8:]}"
        
        # 실제 구독자 수 사용 (travel_channels.subscriber_count)
        subscriber_count = result.subscriber_count or 0
        
        # 실제 영상 수 사용 (travel_channels.video_count 또는 계산된 video_count 중 큰 값)
        video_count = max(result.video_count or 0, result.channel_video_count or 0)
        
        # 구독자 수 포맷팅
        if subscriber_count >= 1000000:
            subscribers = f"{subscriber_count // 10000}만명"
        elif subscriber_count >= 10000:
            subscribers = f"{subscriber_count // 1000}천명"
        else:
            subscribers = f"{subscriber_count:,}명"
        
        channels.append({
            'id': result.channel_id,
            'channel_id': result.channel_id,
            'name': channel_name,
            'subscribers': subscribers,
            'subscriber_count': subscriber_count,
            'video_count': video_count,
            'total_views': result.total_views or 0,
            'thumbnail_url': result.channel_thumbnail_url or None,
            'latest_video_date': result.latest_video_date
        })
    
    print(f"[DEBUG] Returning {len(channels)} channels")
    return channels

