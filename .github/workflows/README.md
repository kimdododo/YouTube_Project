# GitHub Actions 자동 배포 가이드

## 설정 방법

### 1. GCP 서비스 계정 생성 및 권한 부여

```bash
# 서비스 계정 생성
gcloud iam service-accounts create github-actions \
  --display-name="GitHub Actions Service Account" \
  --project=YOUR_PROJECT_ID

# 필요한 권한 부여
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:github-actions@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/run.admin"

gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:github-actions@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser"

gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:github-actions@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/cloudbuild.builds.editor"

gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:github-actions@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/storage.admin"

gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:github-actions@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/artifactregistry.writer"

# 서비스 계정 키 생성
gcloud iam service-accounts keys create github-actions-key.json \
  --iam-account=github-actions@YOUR_PROJECT_ID.iam.gserviceaccount.com \
  --project=YOUR_PROJECT_ID
```

### 2. GitHub Secrets 설정

GitHub 저장소의 Settings > Secrets and variables > Actions에서 다음 secrets를 추가:

- `GCP_PROJECT_ID`: GCP 프로젝트 ID
- `GCP_SA_KEY`: 위에서 생성한 `github-actions-key.json` 파일의 전체 내용

### 3. Artifact Registry 저장소 생성

```bash
gcloud artifacts repositories create cloud-run-source-deploy \
  --repository-format=docker \
  --location=asia-northeast3 \
  --project=YOUR_PROJECT_ID
```

### 4. Cloud Build API 활성화

```bash
gcloud services enable cloudbuild.googleapis.com \
  --project=YOUR_PROJECT_ID
```

## 워크플로우 동작

1. **트리거**: `main` 또는 `master` 브랜치에 push 시 자동 실행
2. **테스트**: Python 테스트 실행 (있는 경우)
3. **빌드**: Docker 이미지 빌드
4. **배포**: Cloud Run에 자동 배포

## 수동 실행

GitHub Actions 탭에서 "Run workflow" 버튼을 클릭하여 수동으로 실행할 수 있습니다.

