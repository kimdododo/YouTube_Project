<<<<<<< HEAD
# YouTube Travel Video Recommendation Project
=======
# 20251107

# Cloud SQL + FastAPI + React 데이터 파이프라인
# ##클라우드 비용 문제로 인한 로컬MYSQL 사용중###
>>>>>>> 6f0bd53dd533a9b99accfbdf5c2942b7b7fdca3b

유튜브 API 데이터를 활용한 여행 영상 추천 서비스입니다.

## 아키텍처

```
┌─────────────────────────────────┐
│   React Frontend (Cloud Run)    │
│   https://yt-frontend-...app    │
└──────────────┬──────────────────┘
               │ HTTP/HTTPS
               │ /api/* → Nginx Proxy
┌──────────────▼──────────────────┐
│   FastAPI Backend (Cloud Run)   │
│   https://yt-backend-...app     │
└──────────────┬──────────────────┘
               │ Unix Socket
┌──────────────▼──────────────────┐
│   Cloud SQL (MySQL)             │
│   poised-journey-479005-f5:... │
└─────────────────────────────────┘
```

## 📦 현재 버전

- **백엔드**: v10
- **프런트엔드**: v6

## 🚀 배포 상태

### 프로덕션 환경 (Google Cloud Run)

- **백엔드 URL**: https://yt-backend-678086020431.asia-northeast3.run.app
- **프런트엔드 URL**: https://yt-frontend-hqgyuzrwxq-du.a.run.app
- **데이터베이스**: Cloud SQL (MySQL) - `poised-journey-479005-f5:asia-northeast3:youtube`

### 주요 기능

- ✅ 사용자 인증 (회원가입/로그인)
- ✅ 여행 취향 테스트 및 저장
- ✅ 개인 맞춤 영상 추천
- ✅ 채널 추천
- ✅ 여행 트렌드 영상
- ✅ 인기 영상 조회

## 📁 프로젝트 구조

```
.
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI 진입점
│   │   ├── core/
│   │   │   ├── auth.py          # JWT 인증
│   │   │   ├── database.py      # SQLAlchemy DB 연결
│   │   │   └── config.py        # 환경 변수 설정
│   │   ├── models/              # SQLAlchemy 모델
│   │   │   ├── user.py
│   │   │   ├── video.py
│   │   │   ├── channel.py
│   │   │   ├── login_history.py
│   │   │   └── user_travel_preference.py
│   │   ├── schemas/             # Pydantic 스키마
│   │   ├── crud/                # CRUD 작업
│   │   ├── api/routes/          # API 라우터
│   │   └── recommendation/      # 추천 알고리즘
│   ├── alembic/                 # 데이터베이스 마이그레이션
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── api/                 # API 클라이언트
│   │   ├── components/          # React 컴포넌트
│   │   └── utils/
│   ├── nginx.conf               # Nginx 설정 (프록시 포함)
│   ├── Dockerfile
│   └── package.json
├── DEPLOY.md                    # 상세 배포 가이드
├── docker-compose.yml           # 로컬 개발용
└── README.md
```

## 🚀 빠른 시작 (로컬 개발)

> 💡 **상세한 Docker 빌드 가이드**: [LOCAL_DOCKER.md](./LOCAL_DOCKER.md)를 참고하세요.

### 1. 환경 변수 설정

`.env` 파일을 루트 디렉토리에 생성:

```env
# 데이터베이스 연결 정보
DB_HOST=localhost
DB_PORT=3307
DB_USER=yt
DB_PASSWORD=your_password
DB_NAME=yt

# JWT 설정
JWT_SECRET=your-secret-key
JWT_ALGO=HS256
JWT_ACCESS_MINUTES=60

# 프론트엔드 API URL
VITE_API_URL=http://localhost:8000
```

### 2. Docker Compose로 실행

```bash
docker-compose up --build
```

### 3. 서비스 접속

- **프론트엔드**: http://localhost:5173
- **백엔드 API**: http://localhost:8000
- **API 문서 (Swagger)**: http://localhost:8000/docs

## 📡 주요 API 엔드포인트

### 인증
- `POST /api/auth/register` - 회원가입
- `POST /api/auth/token` - 로그인 (OAuth2)
- `POST /api/auth/preferences` - 여행 취향 저장
- `GET /api/auth/preferences` - 여행 취향 조회

### 비디오
- `GET /api/videos` - 비디오 목록 조회
- `GET /api/videos/recommended` - 추천 영상
- `GET /api/videos/trends` - 트렌드 영상
- `GET /api/videos/most-liked` - 인기 영상
- `GET /api/videos/personalized` - 개인 맞춤 영상
- `GET /api/videos/diversified` - 다양화된 영상 목록

### 채널
- `GET /api/channels` - 채널 목록
- `GET /api/channels/recommended` - 추천 채널
- `GET /api/channels/search` - 채널 검색

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
- Alembic (마이그레이션)
- Uvicorn

### Frontend
- React 18
- Vite
- Tailwind CSS
- React Router

### Infrastructure
- Docker & Docker Compose
- Google Cloud Run
- Cloud SQL (MySQL)
- Nginx (프론트엔드 프록시)

## 🚀 배포 (Google Cloud Run)

상세한 배포 가이드는 [DEPLOY.md](./DEPLOY.md)를 참고하세요.

### 간단한 배포 절차

1. **이미지 빌드 및 푸시**
   ```powershell
   # 백엔드
   cd backend
   docker build -t docker.io/kimdododo/youtube-backend:v10 .
   docker push docker.io/kimdododo/youtube-backend:v10
   
   # 프런트엔드
   cd frontend
   docker build -t docker.io/kimdododo/youtube-frontend:v6 .
   docker push docker.io/kimdododo/youtube-frontend:v6
   ```

2. **Cloud Run 배포**
   - `DEPLOY.md`의 명령어 사용
   - 백엔드: `min-instances 1` 설정 (콜드 스타트 방지)
   - 프런트엔드: Nginx 프록시 설정 포함

## 🔍 문제 해결

### 배포 관련 문제

#### 백엔드 연결 실패
- **증상**: `Can't connect to MySQL server on 'localhost'`
- **해결**: Cloud SQL Unix 소켓 경로 확인 (`DB_HOST=/cloudsql/...`)
- **버전**: v10에서 `alembic/env.py` 수정으로 해결

#### 프런트엔드 타임아웃
- **증상**: `signal is aborted without reason`, `요청 시간이 초과되었습니다`
- **원인**: 백엔드 응답 지연 또는 502 오류
- **해결**: 
  - 백엔드 `min-instances 1` 설정
  - 프런트엔드 타임아웃 30초로 증가 (v6)
  - Nginx 프록시 타임아웃 60초 설정

#### 마이그레이션 오류
- **증상**: `KeyError: '20250101_01'` 또는 `Failed to open the referenced table 'users'`
- **해결**: 
  - `20250102_01_create_login_history.py`: `down_revision = None`으로 수정
  - `users` 테이블 존재 여부 확인 후 조건부 외래 키 추가

#### Nginx 프록시 502 오류
- **증상**: 프런트엔드에서 `/api/*` 요청 시 502
- **해결**: 
  - `proxy_pass`를 백엔드 URL + `/api/`로 수정
  - Host 헤더를 백엔드 도메인으로 설정
  - 타임아웃 설정 추가

### 로컬 개발 문제

#### 데이터베이스 연결 실패
- `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` 확인
- MySQL 컨테이너가 실행 중인지 확인: `docker-compose ps`

#### 프론트엔드에서 API 호출 실패
- CORS 설정 확인
- `VITE_API_URL` 환경 변수 확인
- 브라우저 개발자 도구의 네트워크 탭 확인

## 📝 변경 이력

### v10 (Backend) / v6 (Frontend) - 2025-11-08

**백엔드 (v10)**
- Cloud SQL Unix 소켓 연결 개선
- Alembic 마이그레이션 체인 수정
- `users` 테이블 존재 여부 확인 후 조건부 외래 키 추가
- `min-instances 1` 설정으로 콜드 스타트 방지

**프런트엔드 (v6)**
- Nginx 프록시 설정 개선 (백엔드 URL + `/api/`)
- 클라이언트 타임아웃 30초로 증가
- Nginx 프록시 타임아웃 60초 설정
- Dockerfile 빌드 검증 추가

**해결된 문제**
- ✅ 백엔드 데이터베이스 연결 오류
- ✅ 프런트엔드 API 타임아웃 오류
- ✅ 마이그레이션 체인 오류
- ✅ Nginx 프록시 502 오류

## 📄 라이선스

이 프로젝트는 내부 사용을 위한 것입니다.

## 🔗 링크

<<<<<<< HEAD
- **프로덕션 프런트엔드**: https://yt-frontend-hqgyuzrwxq-du.a.run.app
- **프로덕션 백엔드**: https://yt-backend-678086020431.asia-northeast3.run.app
- **API 문서**: https://yt-backend-678086020431.asia-northeast3.run.app/docs
=======
LLM-SocialMedia/Qwen3-8B-Korean-Sentiment (좋지만 메모리 요구가 큼 colab에서 불가)
>>>>>>> 6f0bd53dd533a9b99accfbdf5c2942b7b7fdca3b
