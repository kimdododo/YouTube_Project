<<<<<<< HEAD
<<<<<<< HEAD
# Cloud SQL + FastAPI + React 데이터 파이프라인

Cloud SQL(MySQL) ↔ FastAPI 백엔드 ↔ React 프론트엔드 구조의 서비스입니다.

## 🏗️ 아키텍처

```
┌─────────────┐
│   React     │  (포트 5173)
│  Frontend   │
└──────┬──────┘
       │ HTTP
       │
┌──────▼──────┐
│   FastAPI   │  (포트 8000)
│   Backend   │
└──────┬──────┘
       │ SQL
       │
┌──────▼──────┐
│ Cloud SQL   │  (포트 3306)
│   Proxy     │
└──────┬──────┘
       │
┌──────▼──────┐
│  Cloud SQL  │
│  (MySQL)    │
└─────────────┘
```

## 📁 프로젝트 구조

```
.
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI 진입점
│   │   ├── core/
│   │   │   └── database.py      # SQLAlchemy DB 연결
│   │   ├── models/
│   │   │   └── video.py         # SQLAlchemy 모델
│   │   ├── schemas/
│   │   │   └── video.py         # Pydantic 스키마
│   │   ├── crud/
│   │   │   └── video.py         # CRUD 작업
│   │   └── api/
│   │       └── routes/
│   │           └── video.py     # API 라우터
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   │   └── client.js        # Axios 클라이언트
│   │   ├── components/
│   │   │   └── VideoList.jsx    # 비디오 목록 컴포넌트
│   │   └── App.jsx
│   └── Dockerfile.dev
├── docker-compose.yml
├── .env                        # 환경 변수 (수동 생성 필요)
└── README.md
```

## 🚀 빠른 시작

### 1. 환경 변수 설정

`.env` 파일을 루트 디렉토리에 생성하고 다음 내용을 입력하세요:

```env
# Cloud SQL 연결 정보
INSTANCE_CONNECTION_NAME=eastern-gravity-473301-n8:us-central1:kimdohyun

# 데이터베이스 연결 정보
DB_HOST=cloud-sql-proxy
DB_PORT=3306
DB_USER=ytuser
DB_PASSWORD=your_password_here
DB_NAME=yt

# 프론트엔드 API URL
VITE_API_URL=http://localhost:8000
```

**참고**: 
- `INSTANCE_CONNECTION_NAME`은 GCP Cloud SQL 인스턴스 연결 이름입니다.
- `DB_PASSWORD`는 실제 데이터베이스 비밀번호로 변경하세요.
- GCP 서비스 계정 키 파일은 `gcp/service-account.json`에 위치해야 합니다.

### 2. Docker Compose로 전체 실행

```bash
docker-compose up --build
```

### 3. 서비스 접속

- **프론트엔드**: http://localhost:5173
- **백엔드 API**: http://localhost:8000
- **API 문서 (Swagger)**: http://localhost:8000/docs
- **헬스 체크**: http://localhost:8000/ping

### 4. 비디오 목록 테스트

프론트엔드에서 `/api-test` 경로로 접속하면 VideoList 컴포넌트를 확인할 수 있습니다.

## 📡 API 엔드포인트

### 기본
- `GET /` - 루트 엔드포인트
- `GET /ping` - 헬스 체크

### 비디오
- `GET /api/videos` - 비디오 목록 조회
  - Query: `skip` (기본: 0), `limit` (기본: 10), `channel_id` (선택)
- `GET /api/videos/{video_id}` - 특정 비디오 조회
- `POST /api/videos` - 새 비디오 생성

## 🔧 개발

### 백엔드만 실행

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### 프론트엔드만 실행

```bash
cd frontend
npm install
npm run dev
```

## 📦 기술 스택

### Backend
- FastAPI
- SQLAlchemy (ORM)
- PyMySQL
- Uvicorn

### Frontend
- React 18
- Vite
- Axios
- Tailwind CSS

### Infrastructure
- Docker & Docker Compose
- Cloud SQL Proxy
- MySQL (Cloud SQL)

## 🔍 문제 해결

### Cloud SQL Proxy 연결 실패
- `.env` 파일의 `INSTANCE_CONNECTION_NAME`이 올바른지 확인
- `gcp/service-account.json` 파일이 존재하는지 확인
- GCP 서비스 계정에 Cloud SQL Client 권한이 있는지 확인

### 데이터베이스 연결 실패
- `DB_HOST`가 `cloud-sql-proxy`로 설정되어 있는지 확인
- `DB_USER`, `DB_PASSWORD`, `DB_NAME`이 올바른지 확인
- Cloud SQL Proxy가 정상 실행 중인지 확인: `docker-compose ps`

### 프론트엔드에서 API 호출 실패
- CORS 설정 확인 (백엔드의 `main.py`에서 `allow_origins=["*"]` 설정)
- `VITE_API_URL` 환경 변수 확인
- 브라우저 개발자 도구의 네트워크 탭에서 에러 확인

## 📝 라이선스

이 프로젝트는 내부 사용을 위한 것입니다.

=======
=======
>>>>>>> bdc56553ea1f99a2e04176a77c0830ba85d6c085
# YouTube_Project
## 유튜브API Data 활용 프로젝트 
  
### 허깅페이스 유튜브 모델
AmaanP314/youtube-xlm-roberta-base-sentiment-multilingual

LLM-SocialMedia/Qwen3-8B-Korean-Sentiment (좋지만 메모리 요구가 큼 colab에서 불가)
<<<<<<< HEAD
>>>>>>> bdc56553ea1f99a2e04176a77c0830ba85d6c085
=======
>>>>>>> bdc56553ea1f99a2e04176a77c0830ba85d6c085
