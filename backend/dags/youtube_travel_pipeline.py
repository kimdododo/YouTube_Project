"""
YouTube 여행 관련 채널 데이터 수집 및 적재 DAG
"""
from airflow import DAG
from airflow.operators.python import PythonOperator
from airflow.utils.dates import days_ago
from datetime import datetime, timedelta
import sys
import os

# Docker 환경: /opt/airflow/utils, 로컬 환경: backend/utils
dag_dir = os.path.dirname(os.path.abspath(__file__))
if dag_dir.startswith('/opt/airflow'):
    # Docker 환경
    utils_path = '/opt/airflow/utils'
else:
    # 로컬 환경
    backend_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    utils_path = os.path.join(backend_root, 'utils')

if utils_path not in sys.path:
    sys.path.insert(0, utils_path)

from youtube_collector import YouTubeCollector
from db_writer import MySQLWriter, BigQueryWriter
import json


# DAG 기본 설정
default_args = {
    'owner': 'data-engineer',
    'depends_on_past': False,
    'email_on_failure': False,
    'email_on_retry': False,
    'retries': 1,
    'retry_delay': timedelta(minutes=5),
}

dag = DAG(
    'youtube_travel_pipeline',
    default_args=default_args,
    description='YouTube 여행 관련 채널 데이터 수집 및 적재 파이프라인',
    schedule_interval='0 2 * * *',  # 매일 오전 2시 실행
    start_date=days_ago(1),
    catchup=False,
    tags=['youtube', 'travel', 'data-collection'],
)


def _load_channel_list():
    """channel_list.json 파일 로드 및 검증"""
    # channel_list.json 파일 경로
    dag_dir = os.path.dirname(os.path.abspath(__file__))
    channel_list_path = os.path.join(dag_dir, 'channel_list.json')
    
    # 파일 존재 확인
    if not os.path.exists(channel_list_path):
        raise FileNotFoundError(f"channel_list.json not found at {channel_list_path}")
    
    # JSON 파일 읽기 및 유효성 확인
    try:
        with open(channel_list_path, 'r', encoding='utf-8') as f:
            channel_list = json.load(f)
    except json.JSONDecodeError as e:
        raise ValueError(f"Invalid JSON in channel_list.json: {e}")
    
    # 리스트인지 확인
    if not isinstance(channel_list, list):
        raise ValueError(f"channel_list.json must contain a JSON array, got {type(channel_list)}")
    
    # active=True인 채널만 필터링
    active_channels = [ch for ch in channel_list if ch.get('active', True)]

    # 참고 통계 로그 출력
    num_with_id = sum(1 for ch in active_channels if (ch.get('channel_id') or "").strip())
    num_with_handle = sum(1 for ch in active_channels if (ch.get('channel_handle') or "").strip())
    num_with_name = sum(1 for ch in active_channels if (ch.get('name') or "").strip())
    print(
        f"Active channels: {len(active_channels)} | with id: {num_with_id} | "
        f"with handle: {num_with_handle} | with name: {num_with_name}"
    )

    # id/handle/name 중 하나라도 있는 채널만 사용 (이제 name도 허용 → 나중에 name→id 해석)
    active_channels = [
        ch for ch in active_channels
        if (ch.get('channel_id') or "").strip() or (ch.get('channel_handle') or "").strip() or (ch.get('name') or "").strip()
    ]

    print(f"Loaded {len(active_channels)} active channels from channel_list.json (with id/handle/name)")
    
    return active_channels


def _process_single_channel(ch, api_keys, lock=None):
    """
    단일 채널 처리 함수 (병렬 처리용)
    
    Args:
        ch: 채널 정보 딕셔너리
        api_keys: API 키 리스트
        lock: 스레드 동기화용 Lock (선택적)
    
    Returns:
        (success: bool, channel_meta: dict, videos: list, error: str)
    """
    from threading import Lock
    import threading
    
    # 각 스레드마다 독립적인 collector 생성 (API 키 리스트는 공유)
    collector = YouTubeCollector(api_keys=api_keys)
    
    try:
        # channel_id가 있으면 우선 사용 (할당량 절약: 1 unit)
        # 없으면 handle 사용 (할당량 많이 소모: 100 units, 정확도 낮음)
        channel_id = (ch.get('channel_id') or "").strip()
        channel_handle = (ch.get('channel_handle') or "").strip()
        
        # identifier 결정: channel_id 우선, 없으면 handle, 마지막으로 name 해석
        identifier = None
        if channel_id:
            identifier = channel_id
        elif channel_handle:
            identifier = channel_handle
        else:
            channel_name = (ch.get('name') or "").strip()
            if channel_name:
                try:
                    resolved_id = collector.get_channel_id_by_name(channel_name)
                    if resolved_id:
                        identifier = resolved_id
                except Exception as e:
                    return (False, None, [], f"Name resolution error: {e}")
        
        if not identifier:
            return (False, None, [], "No identifier found (id/handle/name)")
        
        # 채널 데이터 수집
        bundle = collector.collect_channel_videos(
            channel_id_or_handle=identifier,
            lookback_hours=8760,  # 1년치
            max_results=500
        )
        
        meta = bundle["channel_meta"]
        if not meta:
            return (False, None, [], "Failed to get metadata")
        
        # 메타데이터에 추가 정보 주입
        meta["name"] = ch.get("name", "")
        meta["category"] = ch.get("category", "")
        meta["subscriber_hint"] = ch.get("subscriber_hint", 0)
        
        vids = bundle["videos"]
        for v in vids:
            v["channel_category"] = ch.get("category", "")
            v["channel_name_human"] = ch.get("name", "")
        
        return (True, meta, vids, None)
        
    except Exception as e:
        error_msg = str(e)
        if 'quotaExceeded' in error_msg or 'quota' in error_msg.lower():
            return (False, None, [], "QUOTA_EXCEEDED")
        else:
            return (False, None, [], f"Error: {e}")


def collect_videos(**context):
    """각 채널의 인기 영상 수집 (병렬 처리)"""
    from airflow.models import Variable
    import json
    from concurrent.futures import ThreadPoolExecutor, as_completed
    import threading
    
    print(f"\n{'='*60}")
    print("API 키 설정 확인")
    print(f"{'='*60}")
    
    # 여러 API 키 로테이션 지원
    try:
        api_keys_json = Variable.get("YOUTUBE_API_KEYS", default_var=None)
        print(f"YOUTUBE_API_KEYS Variable 값: {api_keys_json[:100] if api_keys_json and len(api_keys_json) > 100 else api_keys_json}")
    except Exception as e:
        print(f"⚠️ YOUTUBE_API_KEYS Variable 읽기 실패: {e}")
        api_keys_json = None
    
    if api_keys_json:
        try:
            # JSON 문자열 파싱
            api_keys = json.loads(api_keys_json)
            print(f"파싱된 API 키 타입: {type(api_keys)}")
            
            if isinstance(api_keys, list) and len(api_keys) > 0:
                print(f"✓ Using {len(api_keys)} API keys for rotation")
                # 각 키의 첫 20자만 표시
                for i, key in enumerate(api_keys[:3], 1):
                    print(f"  Key {i}: {key[:20]}...")
                if len(api_keys) > 3:
                    print(f"  ... and {len(api_keys) - 3} more keys")
            else:
                print(f"✗ YOUTUBE_API_KEYS is not a valid list: {type(api_keys)}")
                raise ValueError("YOUTUBE_API_KEYS must be a non-empty JSON array")
        except json.JSONDecodeError as e:
            print(f"✗ JSON 파싱 실패: {e}")
            print("Warning: YOUTUBE_API_KEYS is invalid JSON, falling back to YOUTUBE_API_KEY")
            try:
                api_key = Variable.get("YOUTUBE_API_KEY", default_var=None)
                if not api_key:
                    raise ValueError("YOUTUBE_API_KEY 환경 변수를 설정하세요")
                api_keys = [api_key]
            except Exception as e2:
                print(f"✗ YOUTUBE_API_KEY도 읽기 실패: {e2}")
                raise ValueError("API 키 설정이 필요합니다. YOUTUBE_API_KEYS 또는 YOUTUBE_API_KEY를 설정하세요.")
    else:
        # 단일 API 키 사용 (하위 호환성)
        print("⚠️ YOUTUBE_API_KEYS Variable이 없습니다. YOUTUBE_API_KEY 사용 시도...")
        try:
            api_key = Variable.get("YOUTUBE_API_KEY", default_var=None)
            if not api_key:
                raise ValueError("YOUTUBE_API_KEY 환경 변수를 설정하세요")
            print(f"Using single API key: {api_key[:20]}...")
            api_keys = [api_key]
        except Exception as e:
            print(f"✗ YOUTUBE_API_KEY 읽기 실패: {e}")
            raise ValueError("API 키 설정이 필요합니다. Airflow Variables에서 YOUTUBE_API_KEYS (JSON 배열) 또는 YOUTUBE_API_KEY를 설정하세요.")
    
    print(f"{'='*60}\n")
    
    active_channels = _load_channel_list()
    
    all_videos = []
    channels = []
    failed_channels = []
    
    # 병렬 처리 설정
    max_workers = min(10, len(api_keys) * 2)  # API 키 수에 비례하여 워커 수 결정 (최대 10개)
    print(f"🚀 병렬 처리 시작: {len(active_channels)}개 채널을 {max_workers}개 워커로 처리")
    print(f"{'='*60}\n")
    
    # 스레드 동기화용 Lock
    lock = threading.Lock()
    
    # ThreadPoolExecutor로 병렬 처리
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        # 모든 채널에 대해 작업 제출
        future_to_channel = {
            executor.submit(_process_single_channel, ch, api_keys, lock): ch 
            for ch in active_channels
        }
        
        completed = 0
        quota_exhausted = False
        
        # 완료된 작업 처리
        for future in as_completed(future_to_channel):
            ch = future_to_channel[future]
            completed += 1
            
            try:
                success, meta, vids, error = future.result()
                
                if success:
                    channels.append(meta)
                    all_videos.extend(vids)
                    print(f"[{completed}/{len(active_channels)}] ✓ {ch.get('name')}: {len(vids)} videos")
                else:
                    if error == "QUOTA_EXCEEDED":
                        print(f"[{completed}/{len(active_channels)}] ✗ {ch.get('name')}: API quota exceeded")
                        quota_exhausted = True
                    else:
                        print(f"[{completed}/{len(active_channels)}] ✗ {ch.get('name')}: {error}")
                    failed_channels.append(ch)
                    
            except Exception as e:
                print(f"[{completed}/{len(active_channels)}] ✗ {ch.get('name')}: Exception - {e}")
                failed_channels.append(ch)
            
            # 할당량 초과 시 나머지 작업 취소 (간단한 체크로 변경)
            if quota_exhausted:
                remaining_futures = [f for f in future_to_channel if not f.done()]
                if remaining_futures:
                    print(f"\n⚠️ API quota exhausted. Cancelling {len(remaining_futures)} remaining tasks...")
                    for f in remaining_futures:
                        f.cancel()
                break
    
    print(f"\n{'='*60}")
    print(f"병렬 처리 완료")
    print(f"{'='*60}")
    print(f"📊 수집 결과 요약:")
    print(f"  - 시도한 채널 수: {len(active_channels)}")
    print(f"  - 성공한 채널 수: {len(channels)}")
    print(f"  - 실패한 채널 수: {len(failed_channels)}")
    print(f"  - 수집된 비디오 수: {len(all_videos)}")
    print(f"  - 성공률: {len(channels)/len(active_channels)*100:.1f}% ({len(channels)}/{len(active_channels)})")
    
    # 실패 원인 분석
    if failed_channels:
        print(f"\n🔍 실패 원인 분석:")
        no_id_no_handle = sum(1 for ch in failed_channels if not (ch.get('channel_id') or "").strip() and not (ch.get('channel_handle') or "").strip())
        has_handle = sum(1 for ch in failed_channels if (ch.get('channel_handle') or "").strip())
        has_id = sum(1 for ch in failed_channels if (ch.get('channel_id') or "").strip())
        print(f"  - channel_id 있는 채널 실패: {has_id}개")
        print(f"  - channel_handle만 있는 채널 실패: {has_handle}개")
        print(f"  - id/handle 모두 없는 채널 실패: {no_id_no_handle}개")
        print(f"\n💡 실패한 채널의 대부분이 handle만 있는 경우:")
        print(f"     → handle → ID 변환에 100 units/channel 소모")
        print(f"     → API 할당량 부족으로 실패 가능성 높음")
        print(f"     → 해결: channel_list.json의 channel_id 필드 채우기 권장")
    print(f"\n✅ 채널 데이터:")
    if channels:
        print(f"  - {len(channels)}개 채널 메타데이터 수집됨")
        for i, ch in enumerate(channels[:5], 1):  # 처음 5개만 출력
            print(f"    {i}. {ch.get('name', 'Unknown')} (ID: {ch.get('id', 'N/A')[:20]}...)")
        if len(channels) > 5:
            print(f"    ... 외 {len(channels) - 5}개 채널")
    else:
        print(f"  ⚠️ 채널 데이터가 없습니다!")
    print(f"\n✅ 비디오 데이터:")
    if all_videos:
        print(f"  - {len(all_videos)}개 비디오 수집됨")
        # 채널별 비디오 수 집계
        channel_video_count = {}
        for v in all_videos:
            ch_id = v.get('channel_id', 'unknown')
            channel_video_count[ch_id] = channel_video_count.get(ch_id, 0) + 1
        print(f"  - {len(channel_video_count)}개 채널에서 비디오 수집됨")
        for i, (ch_id, count) in enumerate(list(channel_video_count.items())[:5], 1):
            ch_name = next((ch.get('name', 'Unknown') for ch in channels if ch.get('id') == ch_id), 'Unknown')
            print(f"    {i}. {ch_name}: {count}개 비디오")
        if len(channel_video_count) > 5:
            print(f"    ... 외 {len(channel_video_count) - 5}개 채널")
    else:
        print(f"  ⚠️ 비디오 데이터가 없습니다!")
    
    if len(channels) < len(active_channels):
        missing_count = len(active_channels) - len(channels)
        print(f"\n⚠️ {missing_count}개 채널의 수집이 실패했습니다.")
        print(f"  → 성공률: {len(channels)/len(active_channels)*100:.1f}%")
        
        if missing_count > 0:
            print(f"\n  가능한 실패 원인:")
            print(f"    1. API 할당량 초과 (가장 흔한 원인)")
            print(f"       → handle만 있는 채널은 100 units/channel 소모")
            print(f"       → {len(active_channels)}개 채널 × 100 units = {len(active_channels) * 100} units 이상 필요")
            print(f"       → 일일 할당량: 10,000 units/API 키")
            print(f"       → 현재 API 키: {len(api_keys)}개 = 최대 {len(api_keys) * 10000} units")
            print(f"    2. 채널 handle 해석 실패")
            print(f"    3. 채널이 비활성화되었거나 삭제됨")
            print(f"    4. 네트워크 또는 API 일시적 오류")
            
            print(f"\n  해결 방법 (우선순위):")
            print(f"    1. ⭐ channel_list.json의 channel_id 필드 채우기")
            print(f"       → handle → ID 변환 불필요 → 할당량 1 unit/channel로 감소")
            print(f"       → fill_channel_ids.py 스크립트 사용 권장")
            print(f"    2. 더 많은 API 키 추가 (현재: {len(api_keys)}개)")
            print(f"    3. API 키 할당량 리셋 대기 (자정 자동 리셋)")
            print(f"    4. 실패한 채널만 별도로 재시도")
            
            # 실패한 채널 목록 출력 (처음 15개)
            if failed_channels:
                print(f"\n  실패한 채널 목록 (처음 {min(15, len(failed_channels))}개):")
                for i, ch in enumerate(failed_channels[:15], 1):
                    has_id = "✓" if (ch.get('channel_id') or "").strip() else "✗"
                    has_handle = "✓" if (ch.get('channel_handle') or "").strip() else "✗"
                    print(f"    {i:2d}. {ch.get('name', 'Unknown'):20s} | ID: {has_id} | Handle: {has_handle}")
    print(f"{'='*60}\n")
    
    ti = context['ti']
    ti.xcom_push(key='videos', value=all_videos)
    ti.xcom_push(key='channels', value=channels)
    
    # 빈 데이터 체크 및 경고
    if len(all_videos) == 0:
        print("⚠️ WARNING: No videos collected. Possible reasons:")
        print("  1. API quota exceeded")
        print("  2. No videos found in last 7 days")
        print("  3. Channel ID/handle resolution failed")
    
    if len(channels) == 0:
        print("⚠️ WARNING: No channels collected.")
    
    return all_videos


def collect_comments(**context):
    """각 영상의 댓글 수집"""
    from airflow.models import Variable
    import json
    
    # 이전 태스크에서 비디오 데이터 가져오기
    ti = context['ti']
    
    # 먼저 key로 가져오기 시도
    videos = ti.xcom_pull(task_ids='yt_extract_videos', key='videos')
    
    # 디버깅: XCom 데이터 확인
    print(f"XCom pull (with key='videos') result type: {type(videos)}")
    if videos is not None:
        print(f"XCom pull result length: {len(videos) if isinstance(videos, list) else 'N/A'}")
    
    # return 값으로도 시도 (key가 없을 경우)
    if videos is None:
        videos = ti.xcom_pull(task_ids='yt_extract_videos')
        print(f"XCom pull (no key, return value) result type: {type(videos)}")
        if videos is not None and isinstance(videos, list):
            print(f"XCom pull (return value) length: {len(videos)}")
    
    # videos가 None이면 에러
    if videos is None:
        print("Error: Could not retrieve videos from XCom")
        print("This might indicate that yt_extract_videos task failed")
        raise ValueError("No videos found. Run collect_videos first. Check collect_videos task logs.")
    
    # 빈 리스트인 경우는 정상 (비디오가 없을 수 있음)
    if isinstance(videos, list) and len(videos) == 0:
        print("Warning: Videos list is empty. No comments to collect.")
        ti.xcom_push(key='comments', value=[])
        return []
    
    # 여러 API 키 로테이션 지원 (collect_videos와 동일한 방식)
    api_keys_json = Variable.get("YOUTUBE_API_KEYS", default_var=None)
    if api_keys_json:
        try:
            api_keys = json.loads(api_keys_json)
            if isinstance(api_keys, list) and len(api_keys) > 0:
                print(f"Using {len(api_keys)} API keys for rotation")
                collector = YouTubeCollector(api_keys=api_keys)
            else:
                raise ValueError("YOUTUBE_API_KEYS must be a non-empty JSON array")
        except json.JSONDecodeError:
            api_key = Variable.get("YOUTUBE_API_KEY", default_var=None)
            if not api_key:
                raise ValueError("YOUTUBE_API_KEY 환경 변수를 설정하세요")
            collector = YouTubeCollector(api_key=api_key)
    else:
        api_key = Variable.get("YOUTUBE_API_KEY", default_var=None)
        if not api_key:
            raise ValueError("YOUTUBE_API_KEY 환경 변수를 설정하세요")
        collector = YouTubeCollector(api_key=api_key)
    print(f"\n{'='*60}")
    print(f"댓글 수집 시작")
    print(f"{'='*60}")
    print(f"수집할 비디오 수: {len(videos)}")
    
    # 병렬 처리로 속도 개선
    from concurrent.futures import ThreadPoolExecutor, as_completed
    
    def _collect_comments_for_video(video, api_keys):
        """단일 비디오의 댓글 수집 (병렬 처리용)"""
        # 각 스레드마다 독립적인 collector 생성
        video_collector = YouTubeCollector(api_keys=api_keys)
        
        video_id = video.get('video_id') or video.get('id')
        video_title = video.get('title', 'Unknown')
        channel_name = video.get('channel_name_human', 'Unknown')
        
        if not video_id:
            return (False, video_title, [], "No video_id")
        
        try:
            comments = video_collector.get_video_comments(video_id, max_results=100)
            return (True, video_title, comments, None)
        except Exception as e:
            error_msg = str(e)
            if 'quotaExceeded' in error_msg or 'quota' in error_msg.lower():
                return (False, video_title, [], "QUOTA_EXCEEDED")
            else:
                return (False, video_title, [], str(e))
    
    all_comments = []
    successful_videos = 0
    failed_videos = 0
    quota_exhausted = False
    
    # 병렬 처리 설정 (최대 20개 워커로 댓글 수집 병렬화)
    max_workers = min(20, len(api_keys) * 3)
    print(f"🚀 병렬 댓글 수집 시작: {len(videos)}개 비디오를 {max_workers}개 워커로 처리")
    
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        # 모든 비디오에 대해 작업 제출
        future_to_video = {
            executor.submit(_collect_comments_for_video, video, api_keys): video
            for video in videos
        }
        
        completed = 0
        
        # 완료된 작업 처리
        for future in as_completed(future_to_video):
            video = future_to_video[future]
            completed += 1
            
            try:
                success, video_title, comments, error = future.result()
                
                if success:
                    all_comments.extend(comments)
                    successful_videos += 1
                    if completed % 50 == 0 or len(comments) > 0:
                        channel_name = video.get('channel_name_human', 'Unknown')
                        print(f"[{completed}/{len(videos)}] ✓ {channel_name} - '{video_title[:30]}...': {len(comments)}개 댓글")
                else:
                    failed_videos += 1
                    if error == "QUOTA_EXCEEDED":
                        print(f"[{completed}/{len(videos)}] ✗ QUOTA EXCEEDED: {video_title[:30]}...")
                        quota_exhausted = True
                        # 나머지 작업 취소
                        remaining = [f for f in future_to_video if not f.done()]
                        if remaining:
                            print(f"⚠️ API 할당량 초과. {len(remaining)}개 비디오의 댓글 수집 중단.")
                            for f in remaining:
                                f.cancel()
                        break
                    elif completed % 50 == 0:
                        print(f"[{completed}/{len(videos)}] ✗ Failed: {video_title[:30]}... - {error[:50] if error else 'Unknown error'}")
                        
            except Exception as e:
                failed_videos += 1
                video_title = video.get('title', 'Unknown')
                if completed % 50 == 0:
                    print(f"[{completed}/{len(videos)}] ✗ Exception: {video_title[:30]}... - {str(e)[:50]}")
            
            # 진행률 표시 (100개마다)
            if completed % 100 == 0:
                print(f"\n  Progress: {completed}/{len(videos)} ({completed/len(videos)*100:.1f}%)")
                print(f"  Success: {successful_videos}, Failed: {failed_videos}")
                print()
    
    print(f"\n{'='*60}")
    print(f"댓글 수집 완료")
    print(f"{'='*60}")
    print(f"📊 댓글 수집 결과:")
    print(f"  - 성공한 비디오: {successful_videos}/{len(videos)}")
    print(f"  - 실패한 비디오: {failed_videos}")
    print(f"  - 총 수집된 댓글 수: {len(all_comments)}")
    
    # 비디오별 댓글 수 집계 (처음 10개만)
    if all_comments:
        video_comment_count = {}
        for comment in all_comments:
            vid_id = comment.get('video_id', 'unknown')
            video_comment_count[vid_id] = video_comment_count.get(vid_id, 0) + 1
        print(f"  - {len(video_comment_count)}개 비디오에서 댓글 수집됨")
        print(f"  - 평균 비디오당 댓글 수: {len(all_comments) / len(video_comment_count):.1f}개")
    # XCom에 댓글 데이터 저장
    ti.xcom_push(key='comments', value=all_comments)
    return all_comments


def load_to_mysql(**context):
    """MySQL에 데이터 적재"""
    # 로컬/도커 환경에서 쉽게 바꿀 수 있도록 환경변수로 conn_id 주입
    conn_id = os.environ.get('AIRFLOW_MYSQL_CONN_ID', 'mysql_local')
    mysql_writer = MySQLWriter(conn_id=conn_id)
    
    mysql_writer.create_tables()
    
    # 이전 태스크들에서 데이터 가져오기
    ti = context['ti']
    channels = ti.xcom_pull(task_ids='yt_extract_videos', key='channels')
    videos = ti.xcom_pull(task_ids='yt_extract_videos', key='videos')
    comments = ti.xcom_pull(task_ids='yt_extract_comments', key='comments')
    
    if channels:
        mysql_writer.insert_channels(channels)
    
    if videos:
        # 키워드는 기본적으로 'travel'로 설정 (여행 관련이므로)
        mysql_writer.insert_videos(videos, keyword='travel')
    
    if comments:
        mysql_writer.insert_comments(comments)
    
    print("Data loaded to MySQL successfully")
    return True


def load_to_bigquery(**context):
    """BigQuery에 데이터 적재"""
    from airflow.models import Variable
    import os
    
    print(f"\n{'='*60}")
    print("BigQuery 적재 시작")
    print(f"{'='*60}")
    
    # 프로젝트 ID 가져오기 (환경변수 또는 Airflow Variable)
    try:
        project_id = Variable.get("PROJECT_ID", default_var="eastern-gravity-473301-n8")
    except:
        project_id = os.environ.get('PROJECT_ID', 'eastern-gravity-473301-n8')
    
    try:
        dataset_id = Variable.get("BIGQUERY_DATASET_ID", default_var="youtube_data")
    except:
        dataset_id = "youtube_data"
    
    print(f"Project ID: {project_id}")
    print(f"Dataset ID: {dataset_id}")
    
    # GCP 인증 확인
    credentials_path = os.environ.get('GOOGLE_APPLICATION_CREDENTIALS')
    print(f"GCP Credentials: {credentials_path}")
    
    if credentials_path and not os.path.exists(credentials_path):
        print(f"⚠️ Warning: Credentials file not found at {credentials_path}")
    
    # 이전 태스크들에서 데이터 가져오기 (먼저 데이터 확인)
    ti = context['ti']
    channels = ti.xcom_pull(task_ids='yt_extract_videos', key='channels')
    videos = ti.xcom_pull(task_ids='yt_extract_videos', key='videos')
    comments = ti.xcom_pull(task_ids='yt_extract_comments', key='comments')
    
    # None 체크
    if channels is None:
        print("⚠️ Warning: channels is None from XCom. Trying return value...")
        channels = []
    
    if videos is None:
        print("⚠️ Warning: videos is None from XCom. Trying return value...")
        videos = []
    
    if comments is None:
        print("⚠️ Warning: comments is None from XCom. Trying return value...")
        comments = []
    
    print(f"\n데이터 요약:")
    print(f"  Channels: {len(channels)}")
    print(f"  Videos: {len(videos)}")
    print(f"  Comments: {len(comments)}")
    
    # 데이터가 없으면 BigQuery 적재를 건너뜀
    if len(channels) == 0 and len(videos) == 0 and len(comments) == 0:
        print(f"\n⚠️ WARNING: No data to load to BigQuery!")
        print("This usually means:")
        print("  1. yt_extract_videos task did not collect any data (check its logs)")
        print("  2. API quota might be exceeded")
        print("  3. No videos found in the last 24 hours")
        print("\nSkipping BigQuery load. Check yt_extract_videos and yt_extract_comments task logs.")
        return True
    
    try:
        bq_writer = BigQueryWriter(project_id=project_id, dataset_id=dataset_id)
    except Exception as e:
        print(f"✗ Failed to initialize BigQueryWriter: {type(e).__name__}: {e}")
        raise
    
    success_count = 0
    
    if channels and len(channels) > 0:
        try:
            bq_writer.load_channels(channels, table_id='travel_channels')
            success_count += 1
        except Exception as e:
            print(f"✗ Failed to load channels: {e}")
            raise
    
    if videos and len(videos) > 0:
        try:
            bq_writer.load_videos(videos, table_id='travel_videos')
            success_count += 1
        except Exception as e:
            print(f"✗ Failed to load videos: {e}")
            raise
    
    if comments and len(comments) > 0:
        try:
            bq_writer.load_comments(comments, table_id='travel_comments')
            success_count += 1
        except Exception as e:
            print(f"✗ Failed to load comments: {e}")
            raise
    
    print(f"\n{'='*60}")
    print(f"✓ BigQuery 적재 완료 ({success_count}/3 테이블)")
    print(f"{'='*60}\n")
    return True


# Task 정의
collect_videos_task = PythonOperator(
    task_id='yt_extract_videos',
    python_callable=collect_videos,
    provide_context=True,
    dag=dag,
)

collect_comments_task = PythonOperator(
    task_id='yt_extract_comments',
    python_callable=collect_comments,
    provide_context=True,
    dag=dag,
)

load_mysql_task = PythonOperator(
    task_id='yt_load_mysql',
    python_callable=load_to_mysql,
    provide_context=True,
    dag=dag,
)

# BigQuery 적재는 기본 비활성화(로컬 환경). 환경변수로만 켭니다.
ENABLE_BQ = str(os.environ.get('AIRFLOW_ENABLE_BIGQUERY', 'false')).lower() in ('1', 'true', 'yes')

if ENABLE_BQ:
    load_bigquery_task = PythonOperator(
        task_id='yt_load_bigquery',
        python_callable=load_to_bigquery,
        provide_context=True,
        dag=dag,
    )

# Task 의존성 설정
if ENABLE_BQ:
    collect_videos_task >> collect_comments_task >> load_mysql_task >> load_bigquery_task
else:
    collect_videos_task >> collect_comments_task >> load_mysql_task

