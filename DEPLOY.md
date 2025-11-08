# 배포 가이드

## 1. 로컬에서 이미지 빌드 및 푸시

### 백엔드

```powershell
cd backend
docker build -t docker.io/kimdododo/youtube-backend:v10 .
docker push docker.io/kimdododo/youtube-backend:v10
```

### 프런트엔드

```powershell
cd frontend
docker build -t docker.io/kimdododo/youtube-frontend:v6 .
docker push docker.io/kimdododo/youtube-frontend:v6
```

## 2. Cloud Shell에서 배포

### 백엔드 배포

```bash
gcloud run deploy yt-backend \
  --image docker.io/kimdododo/youtube-backend:v10 \
  --region asia-northeast3 \
  --platform managed \
  --allow-unauthenticated \
  --port 8080 \
  --memory 2Gi \
  --cpu 2 \
  --timeout 300 \
  --min-instances 1 \
  --max-instances 10 \
  --set-env-vars DB_NAME=yt,DB_USER=ytuser,DB_PORT=3306,DB_HOST=/cloudsql/eastern-gravity-473301-n8:us-central1:kimdohyun,JWT_ALGO=HS256,JWT_ACCESS_MINUTES=60 \
  --set-secrets DB_PASSWORD=db-password:latest,JWT_SECRET=jwt-secret:latest \
  --add-cloudsql-instances eastern-gravity-473301-n8:us-central1:kimdohyun \
  --service-account yt-backend@eastern-gravity-473301-n8.iam.gserviceaccount.com
```

### 프런트엔드 배포

```bash
gcloud run deploy yt-frontend \
  --image docker.io/kimdododo/youtube-frontend:v6 \
  --region asia-northeast3 \
  --platform managed \
  --allow-unauthenticated \
  --port 80 \
  --memory 512Mi \
  --cpu 1 \
  --timeout 300
```

## 3. 배포 확인

### 백엔드 로그 확인

```bash
gcloud run services logs read yt-backend \
  --region asia-northeast3 \
  --limit 50
```

### 프런트엔드 로그 확인

```bash
gcloud run services logs read yt-frontend \
  --region asia-northeast3 \
  --limit 50
```

### 서비스 URL 확인

```bash
# 백엔드 URL
gcloud run services describe yt-backend \
  --region asia-northeast3 \
  --format 'value(status.url)'

# 프런트엔드 URL
gcloud run services describe yt-frontend \
  --region asia-northeast3 \
  --format 'value(status.url)'
```

## 변경 사항

### 백엔드 (v10)
- `alembic/env.py`: Unix 소켓 연결 지원 개선
- `?unix_socket=...` 쿼리 파라미터 사용
- `20250102_01_create_login_history.py`: users 테이블 존재 여부 확인 후 조건부 외래 키 추가
- `20250103_01_create_user_travel_preferences.py`: users 테이블 존재 여부 확인 후 조건부 외래 키 추가
- `users` 테이블은 Cloud SQL에 이미 존재한다고 가정 (마이그레이션에서 생성하지 않음)

### 프런트엔드 (v6)
- `nginx.conf`: `/api/` 프록시 수정
  - `proxy_pass`를 백엔드 URL + `/api/`로 수정
  - 타임아웃 설정 추가 (60초)
  - Host 헤더를 백엔드 도메인으로 설정
  - X-Forwarded-Proto를 https로 설정
- `videos.js`: 클라이언트 타임아웃을 10초에서 30초로 증가
- `Dockerfile`: 빌드 확인 및 Nginx 설정 검증 추가

