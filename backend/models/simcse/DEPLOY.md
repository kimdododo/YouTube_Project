# SimCSE 서버 Cloud Run 배포 가이드

## 환경 변수 설정

### 필수 환경 변수

**확인된 모델 파일 경로:** `gs://yt-model-server/kosimcse_travel_archetype_finetuned.onnx`

```bash
GCS_BUCKET_NAME=yt-model-server
GCS_MODEL_PATH=kosimcse_travel_archetype_finetuned.onnx
```

**설명:**
- 버킷 이름: `yt-model-server`
- 파일 경로: `kosimcse_travel_archetype_finetuned.onnx` (버킷 루트에 위치)

## Cloud Run 배포 명령어

### 옵션 1: 기본 Compute Engine 서비스 계정 사용 (권장)

```bash
# 프로젝트 번호 확인
PROJECT_NUMBER=$(gcloud projects describe swift-hangar-477802-t3 --format="value(projectNumber)")
echo "Project Number: $PROJECT_NUMBER"

# 기본 서비스 계정 형식: PROJECT_NUMBER-compute@developer.gserviceaccount.com
# 예: 480607763463-compute@developer.gserviceaccount.com

# 배포 (서비스 계정 자동 사용 - 별도 지정 불필요)
gcloud run deploy simcse-server \
  --image docker.io/YOUR_DOCKERHUB_USERNAME/simcse-server:latest \
  --platform managed \
  --region asia-northeast3 \
  --allow-unauthenticated \
  --port 8080 \
  --set-env-vars \
    GCS_BUCKET_NAME=yt-model-server,\
    GCS_MODEL_PATH=kosimcse_travel_archetype_finetuned.onnx \
  --memory=2Gi \
  --cpu=2 \
  --timeout=300 \
  --max-instances=10
```

### 옵션 2: 기존 백엔드와 동일한 서비스 계정 사용 (권장)

**서비스 계정:** `github-actions@swift-hangar-477802-t3.iam.gserviceaccount.com`

배포 명령어:

```bash
gcloud run deploy simcse-server \
  --image docker.io/YOUR_DOCKERHUB_USERNAME/simcse-server:latest \
  --platform managed \
  --region asia-northeast3 \
  --allow-unauthenticated \
  --port 8080 \
  --service-account=github-actions@swift-hangar-477802-t3.iam.gserviceaccount.com \
  --set-env-vars \
    GCS_BUCKET_NAME=yt-model-server,\
    GCS_MODEL_PATH=kosimcse_travel_archetype_finetuned.onnx \
  --memory=2Gi \
  --cpu=2 \
  --timeout=300 \
  --max-instances=10
```

## 서비스 계정 확인 및 설정

### 1. 기존 Cloud Run 서비스의 서비스 계정 확인

```bash
# 기존 백엔드 서비스의 서비스 계정 확인
gcloud run services describe yt-backend \
  --region asia-northeast3 \
  --format="value(spec.template.spec.serviceAccountName)"
```

### 2. Cloud Run 기본 서비스 계정 사용 (권장)

Cloud Run은 기본적으로 Compute Engine 기본 서비스 계정을 사용합니다:

```bash
# 프로젝트 번호 확인
gcloud projects describe PROJECT_ID --format="value(projectNumber)"

# 기본 서비스 계정 형식
# PROJECT_NUMBER-compute@developer.gserviceaccount.com
```

예시:
- 프로젝트 번호가 `480607763463`이면
- 서비스 계정: `480607763463-compute@developer.gserviceaccount.com`

### 3. 서비스 계정 권한 설정

**사용할 서비스 계정:** `github-actions@swift-hangar-477802-t3.iam.gserviceaccount.com`

Cloud Run 서비스 계정에 Cloud Storage 읽기 권한 부여:

```bash
# 방법 1: 버킷 레벨 권한 (권장 - 특정 버킷만 접근)
gsutil iam ch serviceAccount:github-actions@swift-hangar-477802-t3.iam.gserviceaccount.com:objectViewer gs://yt-model-server

# 방법 2: 프로젝트 레벨 권한 (모든 버킷 접근)
gcloud projects add-iam-policy-binding swift-hangar-477802-t3 \
  --member="serviceAccount:github-actions@swift-hangar-477802-t3.iam.gserviceaccount.com" \
  --role="roles/storage.objectViewer"
```

**권한 확인:**
```bash
# 버킷 권한 확인
gsutil iam get gs://yt-model-server | grep github-actions
```

### 4. 서비스 계정 확인 명령어 요약

```bash
# 방법 1: 기존 Cloud Run 서비스의 서비스 계정 확인
gcloud run services describe yt-backend \
  --region asia-northeast3 \
  --format="value(spec.template.spec.serviceAccountName)"

# 방법 2: 프로젝트 번호 확인 후 기본 서비스 계정 사용
gcloud projects describe swift-hangar-477802-t3 --format="value(projectNumber)"
# 결과 예: 480607763463
# 서비스 계정: 480607763463-compute@developer.gserviceaccount.com

# 방법 3: 모든 서비스 계정 목록 확인
gcloud iam service-accounts list --project=swift-hangar-477802-t3
```

## 모델 파일 경로 확인

Cloud Storage에서 실제 경로 확인:

```bash
# 버킷 내 파일 목록 확인
gsutil ls gs://yt-model-server/

# 특정 파일 확인
gsutil ls gs://yt-model-server/kosimcse_travel_archetype_finetuned.onnx
```

## 배포 후 확인

```bash
# 서비스 URL 확인
gcloud run services describe simcse-server --region asia-northeast3 --format="value(status.url)"

# 헬스 체크
curl https://YOUR_SERVICE_URL/health

# 임베딩 생성 테스트
curl -X POST https://YOUR_SERVICE_URL/predict \
  -H "Content-Type: application/json" \
  -d '{"text": "여행 영상 추천"}'
```

