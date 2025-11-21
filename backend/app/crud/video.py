"""
Video CRUD 작업
데이터베이스 CRUD 연산을 정의합니다.
"""
from sqlalchemy.orm import Session
from sqlalchemy import desc, func, text
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
    """비디오 총 개수 조회 (4분 이상만) - 최적화된 COUNT 쿼리"""
    # COUNT(*) 대신 func.count()를 사용하여 최적화
    query = db.query(func.count(Video.id))
    
    # 4분 = 240초 이상인 영상만 필터링
    query = query.filter(Video.duration_sec >= 240)
    
    if channel_id:
        query = query.filter(Video.channel_id == channel_id)
    
    # scalar()를 사용하여 단일 값 반환
    return query.scalar() or 0


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
    성능 최적화: func.rand() 대신 published_at DESC로 조회 후 Python에서 셔플
    """
    # 후보군 크기 계산 (총량의 5배, 최대 200으로 감소)
    candidate_size = min(max(total * 5, total), 200)

    # 후보군 조회: 4분 이상(Shorts 제외). 최신순으로 조회 후 Python에서 셔플
    # func.rand()는 대용량 테이블에서 매우 느리므로 최신순 조회 후 셔플 사용
    candidates = db.query(Video).filter(
        Video.duration_sec >= 240
    ).order_by(
        desc(Video.published_at)  # 최신순으로 조회 (인덱스 활용)
    ).limit(candidate_size).all()

    # Python에서 셔플 (DB rand()보다 훨씬 빠름)
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


def get_comments_for_video(db: Session, video_id: str, max_comments: int = 200) -> List[str]:
    """
    특정 비디오의 댓글 텍스트 목록 조회 (감정 분석용)
    
    Args:
        db: 데이터베이스 세션
        video_id: 비디오 ID
        max_comments: 최대 조회할 댓글 수 (기본값: 200, 성능/비용 고려)
        
    Returns:
        댓글 텍스트 리스트 (최신순, 좋아요 많은 순으로 정렬)
        
    예시:
        comments = get_comments_for_video(db, "dQw4w9WgXcQ", max_comments=100)
        # -> ["영상 너무 재밌어요", "편집이 깔끔해서 좋아요", ...]
    """
    try:
        # travel_comments 테이블에서 댓글 조회
        # 좋아요 많은 순, 최신순으로 정렬하여 상위 N개만 조회
        query = text("""
            SELECT text 
            FROM travel_comments 
            WHERE video_id = :video_id 
            AND text IS NOT NULL 
            AND text != ''
            AND LENGTH(TRIM(text)) > 0
            ORDER BY like_count DESC, created_at DESC
            LIMIT :limit
        """)
        
        result = db.execute(query, {"video_id": video_id, "limit": max_comments})
        rows = result.fetchall()
        
        # 텍스트만 추출
        comments = [row[0] for row in rows if row[0] and row[0].strip()]
        
        return comments
    except Exception as e:
        # 에러 발생 시 빈 리스트 반환 (서비스 레이어에서 처리)
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"[CRUD] Error fetching comments for video {video_id}: {e}")
        return []


def get_comment_payloads_for_video(
    db: Session,
    video_id: str,
    limit: int = 100,
) -> List[dict]:
    """
    Fetch comment payloads (id/text/like_count) for Bento analysis.
    """
    import logging
    logger = logging.getLogger(__name__)
    
    try:
        # 먼저 전체 댓글 개수 확인 (디버깅용)
        count_query = text("SELECT COUNT(*) FROM travel_comments WHERE video_id = :video_id")
        total_count = db.execute(count_query, {"video_id": video_id}).scalar()
        logger.info("[CRUD] Total comments in DB for video %s: %d", video_id, total_count)
        
        # 텍스트가 있는 댓글 개수 확인
        valid_count_query = text("""
            SELECT COUNT(*) FROM travel_comments 
            WHERE video_id = :video_id 
            AND text IS NOT NULL 
            AND text != ''
        """)
        valid_count = db.execute(valid_count_query, {"video_id": video_id}).scalar()
        logger.info("[CRUD] Valid comments (with text) for video %s: %d", video_id, valid_count)
        
        # 실제 댓글 조회
        query = text(
            """
            SELECT id, text, COALESCE(like_count, 0) AS like_count
            FROM travel_comments
            WHERE video_id = :video_id
              AND text IS NOT NULL
              AND text != ''
            ORDER BY like_count DESC, created_at DESC
            LIMIT :limit
        """
        )
        rows = db.execute(query, {"video_id": video_id, "limit": limit}).fetchall()
        logger.info("[CRUD] Retrieved %d comment rows for video %s", len(rows), video_id)
        
        from app.utils.text_utils import sanitize_comment_text
        
        payloads: List[dict] = []
        for row in rows:
            raw_text = row[1]
            cleaned_text = sanitize_comment_text(raw_text)
            payloads.append(
                {
                    "comment_id": str(row[0]),
                    "text": cleaned_text,
                    "like_count": int(row[2]) if row[2] is not None else 0,
                }
            )
        
        if payloads:
            logger.info("[CRUD] Sample payload (first): comment_id=%s, text_len=%d, like_count=%d",
                       payloads[0].get("comment_id"), len(payloads[0].get("text", "")), payloads[0].get("like_count"))
        else:
            logger.warning("[CRUD] No valid comment payloads for video %s (total in DB: %d, valid: %d)", 
                          video_id, total_count, valid_count)
        
        return payloads
    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        logger.error("[CRUD] Error building comment payloads for %s: %s\n%s", video_id, e, error_trace)
        return []

