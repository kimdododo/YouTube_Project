"""
MySQL 및 BigQuery 데이터 적재 유틸리티
"""
from airflow.hooks.base import BaseHook
from sqlalchemy import create_engine, text
from google.cloud import bigquery
import pandas as pd
from typing import List, Dict
import os
import json
from urllib.parse import quote_plus


class MySQLWriter:
    def __init__(self, conn_id: str = 'cloudsql_mysql'):
        """
        MySQL 연결 초기화
        
        Args:
            conn_id: Airflow Connection ID
        """
        self.conn_id = conn_id
        self.conn = BaseHook.get_connection(conn_id)
        self.engine = None
        
        # 디버깅: Connection 정보 출력 (비밀번호 일부만)
        print(f"Connection '{conn_id}' loaded:")
        print(f"  Host: {self.conn.host}")
        print(f"  Port: {self.conn.port}")
        print(f"  Schema: {self.conn.schema}")
        print(f"  Login: {self.conn.login}")
        print(f"  Password: {'*' * len(str(self.conn.password)) if self.conn.password else 'None'}")
    
    def _get_engine(self):
        """SQLAlchemy 엔진 생성"""
        if self.engine is None:
            # URL 인코딩하여 특수문자 처리 (@ 등)
            login = quote_plus(str(self.conn.login))
            password = quote_plus(str(self.conn.password))
            host = str(self.conn.host)
            port = str(self.conn.port)
            schema = str(self.conn.schema)
            
            connection_string = (
                f"mysql+pymysql://{login}:{password}"
                f"@{host}:{port}/{schema}"
            )
            
            # 디버깅: 연결 정보 출력 (비밀번호 제외)
            print(f"Connecting to MySQL: {host}:{port}/{schema} (user: {self.conn.login})")
            
            # 연결 안정성을 위한 추가 설정
            self.engine = create_engine(
                connection_string,
                pool_pre_ping=True,  # 연결 전 핑 테스트
                pool_recycle=3600,   # 1시간 후 연결 재사용
                pool_size=5,          # 연결 풀 크기
                max_overflow=10,      # 추가 연결 허용
                connect_args={
                    "connect_timeout": 60,  # 연결 타임아웃 60초
                    "read_timeout": 600,    # 읽기 타임아웃 10분
                    "write_timeout": 600,    # 쓰기 타임아웃 10분 (대량 데이터 삽입 대비)
                    "charset": "utf8mb4",
                    "autocommit": False,  # 트랜잭션 관리
                }
            )
        return self.engine
    
    def create_tables(self):
        """필요한 테이블 생성 (이미 존재하면 생성하지 않음)"""
        engine = self._get_engine()
        
        # 연결 재시도 로직 및 상세 디버깅
        import time
        import socket
        max_retries = 3
        retry_delay = 2
        
        # DNS 및 포트 접근 테스트
        host = str(self.conn.host)
        port = int(self.conn.port)
        
        print(f"\n{'='*60}")
        print("연결 진단 시작")
        print(f"{'='*60}")
        
        # 1. DNS 해석 테스트
        try:
            resolved_ip = socket.gethostbyname(host)
            print(f"✓ DNS 해석 성공: {host} -> {resolved_ip}")
        except socket.gaierror as e:
            print(f"✗ DNS 해석 실패: {host} - {e}")
            print(f"  호스트명을 IP 주소로 변경하거나 extra_hosts 설정을 확인하세요.")
        
        # 2. 포트 접근 테스트
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(5)
            result = sock.connect_ex((host, port))
            sock.close()
            if result == 0:
                print(f"✓ 포트 접근 성공: {host}:{port}")
            else:
                print(f"✗ 포트 접근 실패: {host}:{port} (에러 코드: {result})")
                print(f"  Cloud SQL Proxy가 실행 중인지 확인하세요.")
        except Exception as e:
            print(f"✗ 포트 테스트 실패: {e}")
        
        print(f"{'='*60}\n")
        
        # 3. 실제 DB 연결 시도
        for attempt in range(max_retries):
            try:
                print(f"연결 시도 {attempt + 1}/{max_retries}...")
                with engine.connect() as conn:
                    # 간단한 쿼리로 연결 테스트 (SELECT는 자동 커밋됨)
                    result = conn.execute(text("SELECT 1 as test"))
                    test_value = result.fetchone()
                    print(f"✓ 연결 성공! 테스트 쿼리 결과: {test_value}")
                    # 테이블이 이미 존재하면 생성하지 않음
                    # 기존 스키마에 맞춰서 데이터만 삽입
                    print("Using existing tables")
                    return
            except Exception as e:
                error_type = type(e).__name__
                error_msg = str(e)
                print(f"✗ 연결 실패 ({error_type}): {error_msg}")
                
                if attempt < max_retries - 1:
                    print(f"  {retry_delay}초 후 재시도...")
                    time.sleep(retry_delay)
                else:
                    print(f"\n{'='*60}")
                    print("연결 실패 - 해결 방법:")
                    print(f"{'='*60}")
                    print("1. Cloud SQL Proxy가 실행 중인지 확인:")
                    print(f"   Windows: netstat -ano | findstr :{port}")
                    print(f"2. Docker 컨테이너에서 호스트 접근 확인:")
                    print(f"   docker compose exec airflow-scheduler ping {host}")
                    print(f"3. Airflow Connection 설정 확인:")
                    print(f"   Host: {host}")
                    print(f"   Port: {port}")
                    print(f"   Schema: {self.conn.schema}")
                    print(f"   Login: {self.conn.login}")
                    print(f"4. docker-compose.yml에 extra_hosts 설정 확인:")
                    print(f"   extra_hosts:")
                    print(f"     - 'host.docker.internal:host-gateway'")
                    print(f"{'='*60}")
                    raise
            
    
    def insert_channels(self, channels: List[Dict]):
        """채널 데이터 삽입 (중복 시 업데이트)"""
        if not channels:
            return
        
        engine = self._get_engine()
        df = pd.DataFrame(channels)
        
        # 컬럼명 매핑: id, title, description, country, subscriber_count, video_count, view_count, thumbnail_url
        with engine.begin() as conn:
            for _, row in df.iterrows():
                conn.execute(text("""
                    INSERT INTO travel_channels (
                        id, title, description, country,
                        subscriber_count, video_count, view_count, thumbnail_url
                    ) VALUES (
                        :id, :title, :description, :country,
                        :subscriber_count, :video_count, :view_count, :thumbnail_url
                    )
                    ON DUPLICATE KEY UPDATE
                        title = VALUES(title),
                        description = VALUES(description),
                        country = VALUES(country),
                        subscriber_count = VALUES(subscriber_count),
                        video_count = VALUES(video_count),
                        view_count = VALUES(view_count),
                        thumbnail_url = VALUES(thumbnail_url)
                """), {
                    'id': row['id'],
                    'title': row['title'],
                    'description': row.get('description', ''),
                    'country': row.get('country', 'KR'),
                    'subscriber_count': row.get('subscriber_count', 0),
                    'video_count': row.get('video_count', 0),
                    'view_count': row.get('view_count', 0),
                    'thumbnail_url': row.get('thumbnail_url', '')
                })
        
        print(f"Inserted/Updated {len(channels)} channels")
    
    def insert_videos(self, videos: List[Dict], keyword: str = None):
        """영상 데이터 삽입 (배치 삽입으로 최적화)"""
        if not videos:
            return
        
        engine = self._get_engine()
        df = pd.DataFrame(videos)
        
        df['published_at'] = pd.to_datetime(df['published_at'])
        
        # keyword 추가
        if keyword:
            df['keyword'] = keyword
        
        # tags를 JSON 문자열로 변환 (MySQL JSON 타입 저장용)
        if 'tags' in df.columns:
            df['tags'] = df['tags'].apply(lambda x: None if x is None or (isinstance(x, list) and len(x) == 0) else json.dumps(x) if isinstance(x, list) else x)
        
        # 컬럼 순서: id, channel_id, title, description, published_at, duration, view_count, 
        # like_count, comment_count, category_id, tags, thumbnail_url, keyword, region
        
        # 배치 크기 설정 (한 번에 100개씩 처리)
        batch_size = 100
        total_batches = (len(df) + batch_size - 1) // batch_size
        
        print(f"Inserting {len(videos)} videos in {total_batches} batches (batch size: {batch_size})")
        
        for batch_num in range(total_batches):
            start_idx = batch_num * batch_size
            end_idx = min((batch_num + 1) * batch_size, len(df))
            batch_df = df.iloc[start_idx:end_idx]
            
            print(f"Processing batch {batch_num + 1}/{total_batches} ({len(batch_df)} videos)...")
            
            try:
                with engine.begin() as conn:
                    for _, row in batch_df.iterrows():
                        conn.execute(text("""
                            INSERT INTO travel_videos (
                                id, channel_id, title, description, published_at, duration,
                                view_count, like_count, comment_count, category_id, tags,
                                thumbnail_url, keyword, region
                            ) VALUES (
                                :id, :channel_id, :title, :description, :published_at, :duration,
                                :view_count, :like_count, :comment_count, :category_id, :tags,
                                :thumbnail_url, :keyword, :region
                            )
                            ON DUPLICATE KEY UPDATE
                                title = VALUES(title),
                                description = VALUES(description),
                                view_count = VALUES(view_count),
                                like_count = VALUES(like_count),
                                comment_count = VALUES(comment_count)
                        """), {
                            'id': row['id'],
                            'channel_id': row['channel_id'],
                            'title': row['title'],
                            'description': row.get('description', ''),
                            'published_at': row['published_at'],
                            'duration': row.get('duration', ''),
                            'view_count': row.get('view_count', 0),
                            'like_count': row.get('like_count', 0),
                            'comment_count': row.get('comment_count', 0),
                            'category_id': row.get('category_id', 0),
                            'tags': row.get('tags'),  # 이미 JSON 문자열로 변환됨
                            'thumbnail_url': row.get('thumbnail_url', ''),
                            'keyword': row.get('keyword'),
                            'region': row.get('region', 'KR')
                        })
                print(f"✓ Batch {batch_num + 1}/{total_batches} completed ({len(batch_df)} videos)")
            except Exception as e:
                print(f"✗ Batch {batch_num + 1}/{total_batches} failed: {type(e).__name__}: {e}")
                # 실패한 배치만 다시 시도 (개별 삽입으로 fallback)
                print(f"  Retrying batch {batch_num + 1} with individual inserts...")
                with engine.begin() as conn:
                    for idx, row in batch_df.iterrows():
                        try:
                            conn.execute(text("""
                                INSERT INTO travel_videos (
                                    id, channel_id, title, description, published_at, duration,
                                    view_count, like_count, comment_count, category_id, tags,
                                    thumbnail_url, keyword, region
                                ) VALUES (
                                    :id, :channel_id, :title, :description, :published_at, :duration,
                                    :view_count, :like_count, :comment_count, :category_id, :tags,
                                    :thumbnail_url, :keyword, :region
                                )
                                ON DUPLICATE KEY UPDATE
                                    title = VALUES(title),
                                    description = VALUES(description),
                                    view_count = VALUES(view_count),
                                    like_count = VALUES(like_count),
                                    comment_count = VALUES(comment_count)
                            """), {
                                'id': row['id'],
                                'channel_id': row['channel_id'],
                                'title': row['title'],
                                'description': row.get('description', ''),
                                'published_at': row['published_at'],
                                'duration': row.get('duration', ''),
                                'view_count': row.get('view_count', 0),
                                'like_count': row.get('like_count', 0),
                                'comment_count': row.get('comment_count', 0),
                                'category_id': row.get('category_id', 0),
                                'tags': row.get('tags'),
                                'thumbnail_url': row.get('thumbnail_url', ''),
                                'keyword': row.get('keyword'),
                                'region': row.get('region', 'KR')
                            })
                        except Exception as e2:
                            print(f"  ⚠️ Failed to insert video {row.get('id', 'unknown')}: {e2}")
                            continue
        
        print(f"✓ Inserted {len(videos)} videos (total)")
    
    def insert_comments(self, comments: List[Dict]):
        """댓글 데이터 삽입 (배치 삽입으로 최적화)"""
        if not comments:
            return
        
        import time
        engine = self._get_engine()
        df = pd.DataFrame(comments)
        
        df['published_at'] = pd.to_datetime(df['published_at'])
        
        # 배치 크기 설정 (연결 안정성을 위해 50개씩으로 줄임)
        batch_size = 50
        total_batches = (len(df) + batch_size - 1) // batch_size
        
        print(f"Inserting {len(comments)} comments in {total_batches} batches (batch size: {batch_size})")
        
        insert_stmt = text("""
            INSERT INTO travel_comments (
                id, video_id, parent_id, author_name, text, like_count, published_at, language
            ) VALUES (
                :id, :video_id, :parent_id, :author_name, :text, :like_count, :published_at, :language
            )
            ON DUPLICATE KEY UPDATE
                text = VALUES(text),
                like_count = VALUES(like_count)
        """)
        
        for batch_num in range(total_batches):
            start_idx = batch_num * batch_size
            end_idx = min((batch_num + 1) * batch_size, len(df))
            batch_df = df.iloc[start_idx:end_idx]
            
            if batch_num % 20 == 0 or batch_num == total_batches - 1:  # 20배치마다 또는 마지막 배치 로그 출력
                print(f"Processing batch {batch_num + 1}/{total_batches} ({len(batch_df)} comments)...")
            
            # 배치 데이터 준비
            batch_data = []
            for _, row in batch_df.iterrows():
                batch_data.append({
                    'id': row['id'],
                    'video_id': row['video_id'],
                    'parent_id': row.get('parent_id'),
                    'author_name': row['author_name'],
                    'text': row['text'],
                    'like_count': row.get('like_count', 0),
                    'published_at': row['published_at'],
                    'language': row.get('language', 'ko')
                })
            
            # 배치 삽입 시도
            max_retries = 3
            retry_delay = 2
            success = False
            
            for retry in range(max_retries):
                try:
                    with engine.begin() as conn:
                        # executemany로 실제 배치 삽입
                        conn.execute(insert_stmt, batch_data)
                    success = True
                    break
                except Exception as e:
                    if retry < max_retries - 1:
                        print(f"  ⚠️ Batch {batch_num + 1} failed (attempt {retry + 1}/{max_retries}): {type(e).__name__}: {str(e)[:100]}")
                        time.sleep(retry_delay)
                    else:
                        print(f"✗ Batch {batch_num + 1}/{total_batches} failed after {max_retries} attempts: {type(e).__name__}: {e}")
                        # 마지막 시도: 작은 배치로 분할하여 재시도
                        print(f"  Retrying batch {batch_num + 1} with smaller batches (10 comments each)...")
                        small_batch_size = 10
                        for small_batch_num in range((len(batch_data) + small_batch_size - 1) // small_batch_size):
                            small_start = small_batch_num * small_batch_size
                            small_end = min((small_batch_num + 1) * small_batch_size, len(batch_data))
                            small_batch = batch_data[small_start:small_end]
                            
                            try:
                                with engine.begin() as conn:
                                    conn.execute(insert_stmt, small_batch)
                            except Exception as e2:
                                # 개별 삽입으로 최종 시도
                                print(f"    ⚠️ Small batch {small_batch_num + 1} failed, trying individual inserts...")
                                with engine.begin() as conn:
                                    for item in small_batch:
                                        try:
                                            conn.execute(insert_stmt, item)
                                        except Exception as e3:
                                            print(f"      ⚠️ Failed to insert comment {item.get('id', 'unknown')}: {str(e3)[:100]}")
                                            continue
            
            # 배치 간 짧은 대기로 부하 분산
            if batch_num < total_batches - 1:
                time.sleep(0.1)
        
        print(f"✓ Inserted {len(comments)} comments (total)")


class BigQueryWriter:
    def __init__(self, project_id: str = None, dataset_id: str = 'youtube_data'):
        """
        BigQuery 클라이언트 초기화
        
        Args:
            project_id: GCP 프로젝트 ID
            dataset_id: BigQuery 데이터셋 ID
        """
        self.project_id = project_id or os.environ.get('PROJECT_ID', 'eastern-gravity-473301-n8')
        self.dataset_id = dataset_id
        
        # 인증 확인
        credentials_path = os.environ.get('GOOGLE_APPLICATION_CREDENTIALS')
        print(f"Initializing BigQuery client...")
        print(f"  Project ID: {self.project_id}")
        print(f"  Dataset ID: {self.dataset_id}")
        print(f"  Credentials: {credentials_path if credentials_path else 'Using default credentials'}")
        
        try:
            self.client = bigquery.Client(project=self.project_id)
            print(f"✓ BigQuery client initialized successfully")
            self._create_dataset()
        except Exception as e:
            print(f"✗ Failed to initialize BigQuery client: {type(e).__name__}: {e}")
            raise
    
    def _create_dataset(self):
        """데이터셋 생성"""
        dataset_ref = self.client.dataset(self.dataset_id)
        try:
            self.client.get_dataset(dataset_ref)
            print(f"Dataset {self.dataset_id} already exists")
        except Exception:
            dataset = bigquery.Dataset(dataset_ref)
            dataset.location = "US"
            self.client.create_dataset(dataset, exists_ok=True)
            print(f"Created dataset {self.dataset_id}")
    
    def load_channels(self, channels: List[Dict], table_id: str = 'channels'):
        """채널 데이터 로드"""
        if not channels:
            print("No channels to load to BigQuery")
            return
        
        try:
            table_ref = self.client.dataset(self.dataset_id).table(table_id)
            print(f"Loading {len(channels)} channels to BigQuery table: {self.dataset_id}.{table_id}")
            
            df = pd.DataFrame(channels)
            # channels에는 published_at 필드가 없음
            
            job_config = bigquery.LoadJobConfig(
                write_disposition="WRITE_APPEND",  # 누적 적재 (MySQL과 카운트 정렬)
                autodetect=True,
            )
            
            job = self.client.load_table_from_dataframe(df, table_ref, job_config=job_config)
            job.result()  # 작업 완료 대기
            
            if job.errors:
                print(f"✗ Errors during load: {job.errors}")
                raise Exception(f"BigQuery load errors: {job.errors}")
            
            print(f"✓ Loaded {len(channels)} channels to BigQuery table {table_id}")
        except Exception as e:
            print(f"✗ Failed to load channels to BigQuery: {type(e).__name__}: {e}")
            raise
    
    def load_videos(self, videos: List[Dict], table_id: str = 'videos'):
        """영상 데이터 로드"""
        if not videos:
            print("No videos to load to BigQuery")
            return
        
        try:
            table_ref = self.client.dataset(self.dataset_id).table(table_id)
            print(f"Loading {len(videos)} videos to BigQuery table: {self.dataset_id}.{table_id}")
            
            df = pd.DataFrame(videos)
            if 'published_at' in df.columns:
                df['published_at'] = pd.to_datetime(df['published_at'])
            
            job_config = bigquery.LoadJobConfig(
                write_disposition="WRITE_APPEND",
                autodetect=True,
            )
            
            job = self.client.load_table_from_dataframe(df, table_ref, job_config=job_config)
            job.result()  # 작업 완료 대기
            
            if job.errors:
                print(f"✗ Errors during load: {job.errors}")
                raise Exception(f"BigQuery load errors: {job.errors}")
            
            print(f"✓ Loaded {len(videos)} videos to BigQuery table {table_id}")
        except Exception as e:
            print(f"✗ Failed to load videos to BigQuery: {type(e).__name__}: {e}")
            raise
    
    def load_comments(self, comments: List[Dict], table_id: str = 'comments'):
        """댓글 데이터 로드"""
        if not comments:
            print("No comments to load to BigQuery")
            return
        
        try:
            table_ref = self.client.dataset(self.dataset_id).table(table_id)
            print(f"Loading {len(comments)} comments to BigQuery table: {self.dataset_id}.{table_id}")
            
            df = pd.DataFrame(comments)
            if 'published_at' in df.columns:
                df['published_at'] = pd.to_datetime(df['published_at'])
            # comments에는 updated_at 필드가 없음
            
            job_config = bigquery.LoadJobConfig(
                write_disposition="WRITE_APPEND",
                autodetect=True,
            )
            
            job = self.client.load_table_from_dataframe(df, table_ref, job_config=job_config)
            job.result()  # 작업 완료 대기
            
            if job.errors:
                print(f"✗ Errors during load: {job.errors}")
                raise Exception(f"BigQuery load errors: {job.errors}")
            
            print(f"✓ Loaded {len(comments)} comments to BigQuery table {table_id}")
        except Exception as e:
            print(f"✗ Failed to load comments to BigQuery: {type(e).__name__}: {e}")
            raise

