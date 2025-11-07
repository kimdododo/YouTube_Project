"""
YouTube Data API를 사용한 데이터 수집 유틸리티
"""
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
import os
from typing import List, Dict, Optional
import time
import random


class YouTubeCollector:
    def __init__(self, api_key: str = None, api_keys: list = None):
        """
        YouTube Data API v3 클라이언트 초기화
        
        Args:
            api_key: 단일 YouTube Data API 키 (하위 호환성)
            api_keys: 여러 API 키 리스트 (로테이션용, 우선 사용)
        """
        # api_keys가 제공되면 로테이션 모드
        if api_keys and len(api_keys) > 0:
            self.api_keys = api_keys
            self.current_key_index = 0
            self.api_key = self.api_keys[self.current_key_index]
            self.rotation_enabled = True
        elif api_key:
            self.api_keys = [api_key]
            self.current_key_index = 0
            self.api_key = api_key
            self.rotation_enabled = False
        else:
            raise ValueError("Either api_key or api_keys must be provided")
        
        self.youtube = build('youtube', 'v3', developerKey=self.api_key)
        self.quota_exceeded_keys = set()  # 할당량 초과된 키 추적
    
    def _rotate_api_key(self):
        """할당량 초과 시 다음 API 키로 로테이션"""
        if not self.rotation_enabled or len(self.api_keys) <= 1:
            return False
        
        # 현재 키를 할당량 초과 목록에 추가
        self.quota_exceeded_keys.add(self.api_key)
        
        # 사용 가능한 키 찾기
        available_keys = [key for key in self.api_keys if key not in self.quota_exceeded_keys]
        
        if not available_keys:
            # 모든 키가 할당량 초과
            print("[ERROR] All API keys have exceeded quota")
            return False
        
        # 다음 키 선택 (라운드로빈)
        self.current_key_index = (self.current_key_index + 1) % len(self.api_keys)
        new_key = self.api_keys[self.current_key_index]
        
        # 선택한 키가 할당량 초과면 다음 사용 가능한 키 찾기
        if new_key in self.quota_exceeded_keys:
            new_key = available_keys[0]
            self.current_key_index = self.api_keys.index(new_key)
        
        self.api_key = new_key
        self.youtube = build('youtube', 'v3', developerKey=self.api_key)
        print(f"[API KEY ROTATION] Switched to key index {self.current_key_index} (key: {self.api_key[:10]}...)")
        return True
    
    def _handle_quota_error(self, error: HttpError) -> bool:
        """할당량 초과 에러 처리 및 키 로테이션"""
        if error.resp.status == 403 and 'quota' in str(error).lower():
            print(f"[QUOTA EXCEEDED] Current API key quota exceeded")
            return self._rotate_api_key()
        return False
    
    def get_channel_id_by_handle(self, channel_handle: str) -> Optional[str]:
        """
        채널 핸들로 채널 ID 가져오기 (YouTube Data API v3 forHandle 사용)
        할당량 초과 시 자동 키 로테이션
        
        Args:
            channel_handle: 채널 핸들 (예: "@panibottle" 또는 "panibottle")
            
        Returns:
            채널 ID 또는 None
        """
        if not channel_handle:
            return None
        
        # @ 기호가 없으면 추가
        if not channel_handle.startswith('@'):
            channel_handle = '@' + channel_handle
        
        max_retries = len(self.api_keys) if self.rotation_enabled else 1
        
        for attempt in range(max_retries):
            try:
                # YouTube Data API v3의 forHandle 파라미터 사용 (더 정확함)
                # @ 기호 제거 (API에는 @ 없이 전달)
                handle_without_at = channel_handle[1:] if channel_handle.startswith('@') else channel_handle
                
                channels_response = self.youtube.channels().list(
                    part='id',
                    forHandle=handle_without_at
                ).execute()
                
                if channels_response.get('items') and len(channels_response['items']) > 0:
                    return channels_response['items'][0]['id']
                
                # forHandle이 작동하지 않으면 검색으로 fallback
                search_response = self.youtube.search().list(
                    q=handle_without_at,
                    part='snippet',
                    type='channel',
                    maxResults=1
                ).execute()
                
                if search_response.get('items'):
                    return search_response['items'][0]['snippet']['channelId']
                return None
            except HttpError as e:
                if e.resp.status == 403 and 'quota' in str(e).lower():
                    if attempt < max_retries - 1:
                        if self._handle_quota_error(e):
                            continue  # 다음 키로 재시도
                    print(f"Error getting channel ID for handle {channel_handle}: {e}")
                    return None
                print(f"Error getting channel ID for handle {channel_handle}: {e}")
                return None
        
        return None
    
    def get_channel_id_by_name(self, channel_name: str) -> Optional[str]:
        """
        채널 이름으로 채널 ID 가져오기 (검색 기반, API 키 로테이션 지원)
        
        Args:
            channel_name: 채널 이름
            
        Returns:
            채널 ID 또는 None
        """
        max_retries = len(self.api_keys) if self.rotation_enabled else 1
        
        for attempt in range(max_retries):
            try:
                search_response = self.youtube.search().list(
                    q=channel_name,
                    part='snippet',
                    type='channel',
                    maxResults=1
                ).execute()
                
                if search_response.get('items'):
                    return search_response['items'][0]['snippet']['channelId']
                return None
            except HttpError as e:
                if e.resp.status == 403 and 'quota' in str(e).lower():
                    if attempt < max_retries - 1:
                        if self._handle_quota_error(e):
                            continue  # 다음 키로 재시도
                    print(f"Error getting channel ID for name {channel_name}: {e}")
                    return None
                print(f"Error getting channel ID for name {channel_name}: {e}")
                return None
        
        return None
    
    def search_channels(self, keywords: List[str], max_results: int = 50) -> List[Dict]:
        """
        키워드로 채널 검색
        
        Args:
            keywords: 검색 키워드 리스트
            max_results: 최대 결과 수
            
        Returns:
            채널 정보 리스트
        """
        channels = []
        seen_channel_ids = set()
        
        for keyword in keywords:
            try:
                search_response = self.youtube.search().list(
                    q=keyword,
                    part='snippet',
                    type='channel',
                    maxResults=50,
                    order='viewCount'
                ).execute()
                
                for item in search_response.get('items', []):
                    channel_id = item['snippet']['channelId']
                    
                    if channel_id in seen_channel_ids:
                        continue
                    seen_channel_ids.add(channel_id)
                    
                    channel_details = self.get_channel_details(channel_id)
                    if channel_details:
                        channels.append(channel_details)
                        if len(channels) >= max_results:
                            break
                
                time.sleep(0.1)
                
            except HttpError as e:
                print(f"Error searching for keyword '{keyword}': {e}")
                continue
        
        return channels[:max_results]
    
    def get_channel_details(self, channel_id: str) -> Optional[Dict]:
        """
        채널 상세 정보 가져오기
        할당량 초과 시 자동 키 로테이션
        
        Args:
            channel_id: 채널 ID
            
        Returns:
            채널 정보 딕셔너리
        """
        max_retries = len(self.api_keys) if self.rotation_enabled else 1
        
        for attempt in range(max_retries):
            try:
                response = self.youtube.channels().list(
                    part='snippet,statistics',
                    id=channel_id
                ).execute()
                
                if not response.get('items'):
                    return None
                
                item = response['items'][0]
                # country는 기본값 'KR' 설정 (채널 정보에서 직접 가져올 수 없음)
                return {
                    'id': channel_id,  # DB 테이블의 PK
                    'channel_id': channel_id,  # 공통 필드명
                    'title': item['snippet']['title'],
                    'description': item['snippet'].get('description', ''),
                    'country': 'KR',  # 기본값, 필요시 별도 처리
                    'subscriber_count': int(item['statistics'].get('subscriberCount', 0)),
                    'video_count': int(item['statistics'].get('videoCount', 0)),
                    'view_count': int(item['statistics'].get('viewCount', 0)),
                    'thumbnail_url': item['snippet']['thumbnails'].get('default', {}).get('url', '')
                }
            except HttpError as e:
                if e.resp.status == 403 and 'quota' in str(e).lower():
                    if attempt < max_retries - 1:
                        if self._handle_quota_error(e):
                            continue  # 다음 키로 재시도
                    print(f"Error getting channel details for {channel_id}: {e}")
                    return None
                print(f"Error getting channel details for {channel_id}: {e}")
                return None
        
        return None
    
    def _duration_to_seconds(self, iso_duration: str) -> int:
        """Convert ISO8601 duration (e.g., PT10M30S) to seconds."""
        import isodate
        try:
            return int(isodate.parse_duration(iso_duration).total_seconds())
        except Exception:
            return 0

    def get_channel_videos(self, channel_id: str, max_results: int = 10, lookback_hours: int = 24, min_duration_sec: int = 240) -> List[Dict]:
        """
        채널의 인기 영상 목록 가져오기
        할당량 초과 시 자동 키 로테이션
        
        Args:
            channel_id: 채널 ID
            max_results: 최대 영상 수
            
        Returns:
            영상 정보 리스트
        """
        videos = []
        max_retries = len(self.api_keys) if self.rotation_enabled else 1
        
        for attempt in range(max_retries):
            try:
                channel_response = self.youtube.channels().list(
                    part='contentDetails',
                    id=channel_id
                ).execute()
                
                if not channel_response.get('items'):
                    return videos
                
                uploads_playlist_id = channel_response['items'][0]['contentDetails']['relatedPlaylists']['uploads']

                # 페이지네이션 루프
                collected = 0
                page_token = None
                import datetime
                cutoff = datetime.datetime.utcnow() - datetime.timedelta(hours=lookback_hours)

                while True:
                    playlist_items = self.youtube.playlistItems().list(
                        part='snippet,contentDetails',
                        playlistId=uploads_playlist_id,
                        maxResults=min(50, max_results - collected),
                        pageToken=page_token
                    ).execute()

                    video_ids = [item['contentDetails']['videoId'] for item in playlist_items.get('items', [])]
                    if not video_ids:
                        break

                    videos_response = self.youtube.videos().list(
                        part='snippet,statistics,contentDetails',
                        id=','.join(video_ids)
                    ).execute()

                    for item in videos_response.get('items', []):
                        published_at = item['snippet']['publishedAt']
                        try:
                            published_dt = datetime.datetime.fromisoformat(published_at.replace('Z', '+00:00'))
                        except Exception:
                            published_dt = datetime.datetime.utcnow()

                        # lookback cutoff
                        if lookback_hours and published_dt < cutoff:
                            continue

                        # Shorts 필터: duration < min_duration_sec 또는 제목/설명 해시태그 포함 시 제외
                        iso_dur = item['contentDetails'].get('duration', '')
                        dur_sec = self._duration_to_seconds(iso_dur)
                        title = item['snippet']['title']
                        desc = item['snippet'].get('description', '')
                        if dur_sec and dur_sec < min_duration_sec:
                            continue
                        lowered = f"{title} {desc}".lower()
                        if '#shorts' in lowered or 'shorts/' in lowered:
                            continue

                        tags = item['snippet'].get('tags', [])
                        tags_json = None if not tags else tags

                        videos.append({
                            'id': item['id'],
                            'video_id': item['id'],
                            'channel_id': channel_id,
                            'title': title,
                            'description': desc,
                            'published_at': published_at,
                            'duration': iso_dur,
                            'view_count': int(item['statistics'].get('viewCount', 0)),
                            'like_count': int(item['statistics'].get('likeCount', 0)),
                            'comment_count': int(item['statistics'].get('commentCount', 0)),
                            'category_id': int(item['snippet'].get('categoryId', 0)),
                            'tags': tags_json,
                            'thumbnail_url': item['snippet']['thumbnails'].get('default', {}).get('url', ''),
                            'keyword': None,
                            'region': 'KR'
                        })
                        collected += 1
                        if collected >= max_results:
                            break

                    if collected >= max_results:
                        break

                    page_token = playlist_items.get('nextPageToken')
                    if not page_token:
                        break
                    time.sleep(0.1)

                return videos
                
            except HttpError as e:
                if e.resp.status == 403 and 'quota' in str(e).lower():
                    if attempt < max_retries - 1:
                        if self._handle_quota_error(e):
                            continue  # 다음 키로 재시도
                    print(f"Error getting videos for channel {channel_id}: {e}")
                    return videos
                print(f"Error getting videos for channel {channel_id}: {e}")
                return videos
        
        return videos
    
    def resolve_channel_id(self, handle_or_id: str) -> Optional[str]:
        """
        채널 핸들 또는 ID를 실제 채널 ID로 변환
        
        Args:
            handle_or_id: 채널 핸들(@ 포함) 또는 채널 ID
            
        Returns:
            채널 ID 또는 None
        """
        if not handle_or_id:
            return None
        
        # 이미 ID 형식인지 확인 (보통 UC로 시작)
        if handle_or_id.startswith('UC') and len(handle_or_id) == 24:
            return handle_or_id
        
        # 핸들인 경우
        if handle_or_id.startswith('@'):
            return self.get_channel_id_by_handle(handle_or_id)
        
        # @ 없이 핸들만 있는 경우
        return self.get_channel_id_by_handle(f"@{handle_or_id}")
    
    def get_channel_id_by_handle_with_retry(self, channel_handle: str, max_retries: int = 3) -> Optional[str]:
        """할당량 초과 시 자동 키 로테이션하여 재시도"""
        for attempt in range(max_retries):
            try:
                return self.get_channel_id_by_handle(channel_handle)
            except HttpError as e:
                if e.resp.status == 403 and 'quota' in str(e).lower():
                    if not self._handle_quota_error(e):
                        return None  # 모든 키가 할당량 초과
                    # 다음 키로 재시도
                    continue
                raise  # 다른 에러는 그대로 전파
        return None
    
    def get_channel_metadata(self, channel_id: str) -> Optional[Dict]:
        """
        채널 메타데이터 가져오기 (기존 get_channel_details의 alias)
        
        Args:
            channel_id: 채널 ID
            
        Returns:
            채널 메타데이터 딕셔너리
        """
        return self.get_channel_details(channel_id)
    
    def collect_channel_videos(self, channel_id_or_handle: str, lookback_hours: int = 24, max_results: int = 50) -> Dict:
        """
        채널의 비디오를 수집하고 채널 메타데이터와 함께 반환
        할당량 초과 시 자동으로 다음 API 키로 로테이션하여 재시도
        
        Args:
            channel_id_or_handle: 채널 ID 또는 핸들
            lookback_hours: 최근 몇 시간 이내의 비디오만 수집 (현재는 무시, max_results 우선)
            max_results: 최대 영상 수
            
        Returns:
            {
                "channel_meta": {...},  # 채널 메타데이터
                "videos": [...]  # 비디오 리스트
            }
        """
        max_retries = len(self.api_keys) if self.rotation_enabled else 1
        
        for attempt in range(max_retries):
            try:
                # 채널 ID 해결
                channel_id = self.resolve_channel_id(channel_id_or_handle)
                if not channel_id:
                    return {"channel_meta": None, "videos": []}
                
                # 채널 메타데이터 가져오기
                channel_meta = self.get_channel_metadata(channel_id)
                if not channel_meta:
                    return {"channel_meta": None, "videos": []}
                
                # 비디오 수집
                videos = self.get_channel_videos(channel_id, max_results=max_results)
                
                return {
                    "channel_meta": channel_meta,
                    "videos": videos
                }
            except HttpError as e:
                if e.resp.status == 403 and 'quota' in str(e).lower():
                    if attempt < max_retries - 1:
                        if self._handle_quota_error(e):
                            continue  # 다음 키로 재시도
                    # 모든 키가 할당량 초과이거나 마지막 시도
                    raise
                raise  # 다른 에러는 그대로 전파
        
        return {"channel_meta": None, "videos": []}
    
    def get_video_comments(self, video_id: str, max_results: int = 100) -> List[Dict]:
        """
        영상의 댓글 가져오기
        할당량 초과 시 자동 키 로테이션
        
        Args:
            video_id: 영상 ID
            max_results: 최대 댓글 수
            
        Returns:
            댓글 정보 리스트
        """
        comments = []
        max_retries = len(self.api_keys) if self.rotation_enabled else 1
        
        for attempt in range(max_retries):
            try:
                comments_response = self.youtube.commentThreads().list(
                    part='snippet',
                    videoId=video_id,
                    maxResults=min(max_results, 100),
                    order='relevance'
                ).execute()
                
                for item in comments_response.get('items', []):
                    top_level_comment = item['snippet']['topLevelComment']['snippet']
                    comment_id = item['snippet']['topLevelComment']['id']
                    comments.append({
                        'id': comment_id,  # DB 테이블의 PK
                        'comment_id': comment_id,  # 공통 필드명
                        'video_id': video_id,
                        'parent_id': None,  # 최상위 댓글은 parent_id가 NULL
                        'author_name': top_level_comment['authorDisplayName'],
                        'text': top_level_comment['textDisplay'],
                        'like_count': int(top_level_comment.get('likeCount', 0)),
                        'published_at': top_level_comment['publishedAt'],
                        'language': 'ko'  # 기본값, 필요시 언어 감지 로직 추가 가능
                    })
                
                time.sleep(0.1)
                return comments  # 성공 시 바로 반환
                
            except HttpError as e:
                if e.resp.status == 403:
                    if 'quota' in str(e).lower():
                        # 할당량 초과인 경우 키 로테이션 시도
                        if attempt < max_retries - 1:
                            if self._handle_quota_error(e):
                                continue  # 다음 키로 재시도
                        print(f"Error getting comments for video {video_id}: {e}")
                        return comments
                    else:
                        # 댓글이 비활성화된 경우
                        print(f"Comments disabled for video {video_id}")
                        return comments
                print(f"Error getting comments for video {video_id}: {e}")
                return comments
        
        return comments

