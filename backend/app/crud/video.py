"""
Video CRUD 작업
데이터베이스 CRUD 연산을 정의합니다.
"""
from sqlalchemy.orm import Session
from sqlalchemy import desc, func
from typing import List, Optional
from app.models.video import Video
from app.schemas.video import VideoCreate, VideoUpdate


def get_video(db: Session, video_id: str) -> Optional[Video]:
    """ID로 비디오 조회 (video_id는 문자열)"""
    return db.query(Video).filter(Video.id == video_id).first()


def get_video_by_id(db: Session, video_id: str) -> Optional[Video]:
    """ID로 비디오 조회 (get_video와 동일)"""
    return get_video(db, video_id)


def get_videos(
    db: Session,
    skip: int = 0,
    limit: int = 10,
    channel_id: Optional[str] = None
) -> List[Video]:
    """비디오 목록 조회 (페이지네이션 지원, 4분 이상만)"""
    query = db.query(Video)
    
    # 4분 = 240초 이상인 영상만 필터링
    query = query.filter(Video.duration_sec >= 240)
    
    # 채널 ID 필터링
    if channel_id:
        query = query.filter(Video.channel_id == channel_id)
    
    # 최신순 정렬 및 페이지네이션
    return query.order_by(desc(Video.published_at)).offset(skip).limit(limit).all()


def get_videos_count(db: Session, channel_id: Optional[str] = None) -> int:
    """비디오 총 개수 조회 (4분 이상만)"""
    query = db.query(Video)
    
    # 4분 = 240초 이상인 영상만 필터링
    query = query.filter(Video.duration_sec >= 240)
    
    if channel_id:
        query = query.filter(Video.channel_id == channel_id)
    
    return query.count()


def create_video(db: Session, video: VideoCreate) -> Video:
    """새 비디오 생성"""
    db_video = Video(
        id=video.id,
        channel_id=video.channel_id,
        title=video.title,
        description=video.description,
        published_at=video.published_at,
        duration=video.duration,
        duration_sec=video.duration_sec,
        view_count=video.view_count,
        like_count=video.like_count,
        comment_count=video.comment_count,
        category_id=video.category_id,
        tags=video.tags,
        thumbnail_url=video.thumbnail_url,
        keyword=video.keyword,
        region=video.region,
        is_shorts=video.is_shorts
    )
    db.add(db_video)
    db.commit()
    db.refresh(db_video)
    return db_video


def update_video(db: Session, video_id: str, video_update: VideoUpdate) -> Optional[Video]:
    """비디오 업데이트"""
    db_video = get_video(db, video_id)
    if not db_video:
        return None
    
    update_data = video_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_video, field, value)
    
    db.commit()
    db.refresh(db_video)
    return db_video


def delete_video(db: Session, video_id: str) -> bool:
    """비디오 삭제"""
    db_video = get_video(db, video_id)
    if not db_video:
        return False
    
    db.delete(db_video)
    db.commit()
    return True


def get_recommended_videos(
    db: Session,
    skip: int = 0,
    limit: int = 10
) -> List[Video]:
    """추천 비디오 목록 조회 (조회수 기준 상위, 4분 이상만)"""
    # 4분 = 240초 이상인 영상만 필터링
    # MySQL 호환: NULL 값은 0으로 처리하여 마지막으로 정렬
    return db.query(Video).filter(
        Video.duration_sec >= 240
    ).order_by(
        desc(Video.view_count),
        desc(Video.published_at)
    ).offset(skip).limit(limit).all()


def get_trend_videos(
    db: Session,
    skip: int = 0,
    limit: int = 10
) -> List[Video]:
    """트렌드 비디오 목록 조회 (최근 게시일 기준, 4분 이상만)"""
    # 4분 = 240초 이상인 영상만 필터링
    # MySQL 호환: NULL 값은 자동으로 마지막으로 정렬됨
    return db.query(Video).filter(
        Video.duration_sec >= 240
    ).order_by(
        desc(Video.published_at)
    ).offset(skip).limit(limit).all()


def get_most_liked_videos(
    db: Session,
    skip: int = 0,
    limit: int = 10
) -> List[Video]:
    """가장 많은 좋아요를 받은 비디오 목록 조회 (좋아요 수 기준 상위, 4분 이상만)"""
    # 4분 = 240초 이상인 영상만 필터링
    # like_count가 NULL이거나 0인 경우도 포함하여 조회 (NULL은 0으로 처리)
    from sqlalchemy import or_, case
    
    query = db.query(Video).filter(
        Video.duration_sec >= 240
    )
    
    # 좋아요 수가 NULL이 아닌 영상 우선, 없으면 조회수 기준
    # MySQL에서는 NULL 값을 0으로 처리하여 정렬
    query = query.order_by(
        desc(case((Video.like_count.is_(None), 0), else_=Video.like_count)),
        desc(Video.view_count),  # 좋아요가 같으면 조회수로 정렬
        desc(Video.published_at)  # 최신순
    ).offset(skip).limit(limit)
    
    results = query.all()
    print(f"[DEBUG] get_most_liked_videos: Found {len(results)} videos")
    
    return results


def get_diversified_videos(
    db: Session,
    total: int = 20,
    max_per_channel: int = 1
) -> List[Video]:
    """채널 다양화를 보장하여 영상 목록 조회 (4분 이상만)
    간단한 전략: 상위 풀(최근 + 조회수 상위)에서 넉넉히 가져온 뒤
    파이썬에서 채널별 최대 max_per_channel개씩 선별.
    """
    # 넉넉한 후보군 크기 계산 (총량의 10배, 최대 500)
    candidate_size = min(max(total * 10, total), 500)

    # 후보군 조회: 4분 이상(Shorts 제외). 순서는 무작위 샘플링을 우선시
    candidates = db.query(Video).filter(
        Video.duration_sec >= 240
    ).order_by(
        func.rand()  # MySQL 무작위 추출
    ).limit(candidate_size).all()

    # 무작위성 보강 (DB 무작위 + 추가 셔플)
    import random
    random.shuffle(candidates)

    # 채널 다양화 선택
    selected: list[Video] = []
    per_channel_counts: dict[str, int] = {}
    for v in candidates:
        ch = v.channel_id or "unknown"
        cnt = per_channel_counts.get(ch, 0)
        if cnt < max_per_channel:
            selected.append(v)
            per_channel_counts[ch] = cnt + 1
            if len(selected) >= total:
                break

    # 부족하면 제약을 완화하여 채우기
    if len(selected) < total:
        seen_ids = {v.id for v in selected}
        for v in candidates:
            if v.id in seen_ids:
                continue
            selected.append(v)
            seen_ids.add(v.id)
            if len(selected) >= total:
                break

    return selected

