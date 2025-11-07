# FastAPI 백엔드

YouTube 데이터 수집 파이프라인 백엔드 API 서버

**참고**: Airflow는 다른 컴퓨터에서 데이터를 수집하여 Cloud SQL에 저장하고, 이 백엔드는 Cloud SQL에서 데이터를 읽어 API로 제공합니다.

## 폴더 구조

```
backend/
├── main.py              # FastAPI 진입점 및 API 엔드포인트
├── database.py          # 데이터베이스 연결 유틸리티
├── requirements.txt      # 백엔드 패키지 목록
├── .env                 # DB 연결 정보 (Cloud SQL) - 수동 생성 필요
└── README.md            # 이 파일
```

## 설정

### 1. 환경 변수 설정 (.env 파일 생성)

`backend` 폴더에 `.env` 파일을 생성하고 다음 내용을 입력하세요:

```env
# Cloud SQL 연결 정보
DB_HOST=host.docker.internal
DB_PORT=3307
DB_USER=ytuser
DB_PASSWORD=your_password_here
DB_NAME=yt
```

**참고**: 
- 로컬 개발 시: `DB_HOST=localhost` 또는 `127.0.0.1`
- Docker 컨테이너에서 실행 시: `DB_HOST=host.docker.internal`
- Cloud SQL Proxy 포트에 맞게 `DB_PORT` 설정 (기본: 3307)

### 2. 패키지 설치

```bash
cd backend
pip install -r requirements.txt
```

### 3. 서버 실행

```bash
# 개발 모드
python main.py

# 또는 uvicorn 직접 사용
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

서버가 실행되면 다음 주소에서 접근 가능합니다:
- API 문서: http://localhost:8000/docs
- 대체 문서: http://localhost:8000/redoc
- 헬스 체크: http://localhost:8000/health

## API 엔드포인트

### 기본 엔드포인트
- `GET /` - 루트 엔드포인트
- `GET /health` - 헬스 체크 (DB 연결 상태 포함)

### 데이터 조회 API
- `GET /api/videos` - 비디오 목록 조회
  - Query 파라미터: `limit` (기본: 10), `offset` (기본: 0), `channel_id` (선택)
- `GET /api/videos/{video_id}` - 특정 비디오 상세 정보
- `GET /api/comments` - 댓글 목록 조회
  - Query 파라미터: `video_id` (선택), `limit`, `offset`
- `GET /api/channels` - 채널 목록 조회
  - Query 파라미터: `limit`, `offset`
- `GET /api/stats` - 전체 통계 정보 (비디오 수, 채널 수, 댓글 수 등)

### API 문서
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## 주요 패키지

- **FastAPI**: 웹 프레임워크
- **Uvicorn**: ASGI 서버
- **python-dotenv**: 환경 변수 관리
- **pymysql**: MySQL 연결 (Cloud SQL)
- **SQLAlchemy**: ORM (선택사항)

## 데이터베이스 구조

Airflow가 다른 컴퓨터에서 수집한 데이터는 다음 테이블에 저장됩니다:
- `travel_videos`: 여행 비디오 정보
- `travel_comments`: 비디오 댓글 정보

백엔드는 이 테이블들을 읽어 API로 제공합니다.

