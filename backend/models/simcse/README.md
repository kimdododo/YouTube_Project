# SimCSE 모델 서버

Cloud Run에서 실행되는 SimCSE ONNX 모델 서버입니다.

## 구조

```
backend/models/simcse/
├── server.py          # FastAPI 서버 코드
├── Dockerfile         # Docker 이미지 빌드 파일
├── requirements.txt   # Python 의존성
└── README.md         # 이 파일
```

## 사용 방법

### 1. Cloud Storage에 모델 업로드

ONNX 모델 파일을 Cloud Storage에 업로드하세요.

```bash
# 예시: gsutil을 사용한 업로드
gsutil cp model.onnx gs://YOUR_BUCKET_NAME/models/simcse/model.onnx
```

### 2. 로컬 빌드 및 테스트

```bash
cd backend/models/simcse
docker build -t simcse-server .
docker run -p 8080:8080 simcse-server
```

### 3. API 테스트

```bash
# 헬스 체크
curl http://localhost:8080/health

# 임베딩 생성
curl -X POST http://localhost:8080/predict \
  -H "Content-Type: application/json" \
  -d '{"text": "여행 영상 추천"}'
```

### 4. Cloud Run 배포

```bash
# Google Cloud Container Registry 또는 Artifact Registry에 이미지 푸시
gcloud builds submit --tag gcr.io/PROJECT_ID/simcse-server

# Cloud Run에 배포 (환경 변수 설정 포함)
gcloud run deploy simcse-server \
  --image gcr.io/PROJECT_ID/simcse-server \
  --platform managed \
  --region asia-northeast3 \
  --allow-unauthenticated \
  --port 8080 \
  --set-env-vars GCS_BUCKET_NAME=YOUR_BUCKET_NAME,GCS_MODEL_PATH=models/simcse/model.onnx \
  --service-account=YOUR_SERVICE_ACCOUNT@PROJECT_ID.iam.gserviceaccount.com
```

**환경 변수:**
- `GCS_BUCKET_NAME`: Cloud Storage 버킷 이름 (필수)
- `GCS_MODEL_PATH`: Cloud Storage 내 모델 파일 경로 (기본값: `models/simcse/model.onnx`)
- `MODEL_PATH`: 로컬 저장 경로 (기본값: `/app/model/model.onnx`)

**서비스 계정 권한:**
- Cloud Run 서비스 계정에 `Storage Object Viewer` 역할이 필요합니다.

## API 엔드포인트

- `GET /`: 서버 정보
- `GET /health`: 헬스 체크
- `POST /predict`: 텍스트 임베딩 생성
  - Request: `{"text": "텍스트"}`
  - Response: `{"vector": [[...]], "dimension": 768}`

## 주의사항

- `dummy_embed()` 함수는 현재 더미 데이터를 반환합니다.
- 실제 SimCSE 모델을 사용하려면 전처리/토크나이저 로직을 구현해야 합니다.
- `model.onnx` 파일이 없으면 빌드가 실패할 수 있습니다.

