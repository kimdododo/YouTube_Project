# 🚀 Cloud Run 자동 배포 가이드

GitHub에 코드를 push하면 자동으로 테스트 → 빌드 → 배포가 실행됩니다.

## 📋 목차

1. [파일 구조](#파일-구조)
2. [설정 단계](#설정-단계)
3. [배포 프로세스](#배포-프로세스)
4. [각 단계 설명](#각-단계-설명)
5. [트러블슈팅](#트러블슈팅)

---

## 📁 파일 구조

```
프로젝트 루트/
├── cloudbuild.yaml          # Cloud Build 설정 파일
├── .github/
│   └── workflows/
│       └── deploy.yml       # GitHub Actions 워크플로우
└── backend/
    └── Dockerfile           # 백엔드 Docker 이미지 빌드 파일
```

---

## ⚙️ 설정 단계

### 1️⃣ GCP 서비스 계정 생성

```bash
# 프로젝트 ID 설정
export PROJECT_ID="your-gcp-project-id"
export REGION="asia-northeast3"
export SERVICE_NAME="yt-backend"

# 서비스 계정 생성
gcloud iam service-accounts create github-actions \
  --display-name="GitHub Actions Service Account" \
  --project=$PROJECT_ID

# 필요한 권한 부여
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:github-actions@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/run.admin"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:github-actions@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:github-actions@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/cloudbuild.builds.editor"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:github-actions@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/storage.admin"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:github-actions@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/artifactregistry.writer"

# 서비스 계정 키 생성
gcloud iam service-accounts keys create github-actions-key.json \
  --iam-account=github-actions@$PROJECT_ID.iam.gserviceaccount.com \
  --project=$PROJECT_ID
```

### 2️⃣ Artifact Registry 저장소 생성

```bash
gcloud artifacts repositories create cloud-run-source-deploy \
  --repository-format=docker \
  --location=$REGION \
  --project=$PROJECT_ID
```

### 3️⃣ Cloud Build API 활성화

```bash
gcloud services enable cloudbuild.googleapis.com \
  --project=$PROJECT_ID
```

### 4️⃣ GitHub Secrets 설정

GitHub 저장소 → **Settings** → **Secrets and variables** → **Actions**에서 다음 secrets 추가:

| Secret 이름 | 설명 | 예시 |
|------------|------|------|
| `GCP_PROJECT_ID` | GCP 프로젝트 ID | `my-project-123456` |
| `GCP_SA_KEY` | 서비스 계정 키 JSON 전체 내용 | `{"type": "service_account", ...}` |

**GCP_SA_KEY 설정 방법:**
```bash
# 생성된 키 파일의 전체 내용을 복사
cat github-actions-key.json
# → 출력된 JSON 전체를 GitHub Secret에 붙여넣기
```

---

## 🔄 배포 프로세스

### 자동 배포 트리거

다음 경우에 자동으로 배포가 시작됩니다:

- ✅ `main` 또는 `master` 브랜치에 push
- ✅ `backend/` 디렉토리 변경
- ✅ `cloudbuild.yaml` 변경
- ✅ `.github/workflows/deploy.yml` 변경

### 수동 실행

GitHub Actions 탭에서 **"Run workflow"** 버튼을 클릭하여 수동 실행 가능합니다.

---

## 📝 각 단계 설명

### 1️⃣ 테스트 단계 (`run-tests`)

**목적**: 코드 품질 검증

**실행 내용**:
- Python 테스트 의존성 설치 (`pytest`, `pytest-cov` 등)
- 테스트 파일이 있으면 실행
- 테스트 파일이 없으면 import 체크만 수행
- 실패 시 빌드 중단

**로그 위치**: Cloud Build 로그

### 2️⃣ 이미지 빌드 단계 (`build-image`)

**목적**: Docker 이미지 생성

**실행 내용**:
- `backend/Dockerfile`을 사용하여 이미지 빌드
- 이미지 태그:
  - `asia-northeast3-docker.pkg.dev/PROJECT_ID/cloud-run-source-deploy/yt-backend:SHORT_SHA`
  - `asia-northeast3-docker.pkg.dev/PROJECT_ID/cloud-run-source-deploy/yt-backend:latest`

**빌드 머신**: `E2_HIGHCPU_8` (고성능 빌드)

### 3️⃣ 이미지 푸시 단계 (`push-image`)

**목적**: Artifact Registry에 이미지 업로드

**실행 내용**:
- 빌드된 이미지를 Artifact Registry에 푸시
- 모든 태그 함께 푸시

### 4️⃣ 배포 단계 (`deploy-to-cloud-run`)

**목적**: Cloud Run에 새 버전 배포

**실행 내용**:
1. 기존 서비스 설정 확인
2. **기존 환경 변수와 secrets 자동 유지** ✅
3. 새 이미지로 배포
4. 서비스 URL 출력

**배포 설정**:
- 메모리: 2Gi
- CPU: 2
- 타임아웃: 300초
- 최대 인스턴스: 10
- 최소 인스턴스: 0

---

## 🔍 환경 변수 및 Secrets 유지

### 자동 유지 메커니즘

`gcloud run deploy` 명령은 **기본적으로 기존 서비스의 환경 변수와 secrets를 유지**합니다.

- ✅ 기존 환경 변수: 자동 유지
- ✅ 기존 secrets: 자동 유지
- ✅ 기존 서비스 계정: 자동 유지

### 환경 변수/Secrets 추가/수정이 필요한 경우

Cloud Run 콘솔에서 직접 수정하거나, `cloudbuild.yaml`의 배포 단계에 다음을 추가:

```yaml
# 환경 변수 추가/수정
--update-env-vars=KEY1=value1,KEY2=value2

# Secrets 추가/수정
--update-secrets=SECRET1=secret-name:latest,SECRET2=secret-name2:latest
```

---

## 📊 빌드 로그 확인

### Cloud Build 로그

1. **GCP 콘솔**:
   ```
   https://console.cloud.google.com/cloud-build/builds?project=YOUR_PROJECT_ID
   ```

2. **GitHub Actions**:
   - Actions 탭 → 최근 워크플로우 실행 클릭
   - 각 단계별 로그 확인

### 주요 로그 메시지

- `📦 Installing test dependencies...` - 테스트 의존성 설치
- `🧪 Running tests...` - 테스트 실행
- `🔍 Checking imports...` - Import 검증
- `🚀 Deploying to Cloud Run...` - 배포 시작
- `✅ Deployment completed successfully` - 배포 완료
- `🌐 Service URL: ...` - 배포된 서비스 URL

---

## 🐛 트러블슈팅

### 문제 1: 권한 오류

**증상**: `Permission denied` 또는 `403 Forbidden`

**해결**:
```bash
# 서비스 계정 권한 확인
gcloud projects get-iam-policy $PROJECT_ID \
  --flatten="bindings[].members" \
  --filter="bindings.members:github-actions@$PROJECT_ID.iam.gserviceaccount.com"
```

### 문제 2: Artifact Registry 접근 오류

**증상**: `Failed to push image`

**해결**:
```bash
# Artifact Registry 저장소 확인
gcloud artifacts repositories list --location=$REGION

# Docker 인증 확인
gcloud auth configure-docker asia-northeast3-docker.pkg.dev
```

### 문제 3: 테스트 실패

**증상**: 테스트 단계에서 실패

**해결**:
- 로컬에서 테스트 실행하여 문제 확인
- 테스트 파일이 없으면 자동으로 스킵됨
- Import 체크만 수행

### 문제 4: 배포 후 환경 변수 누락

**증상**: 배포 후 환경 변수가 사라짐

**해결**:
- Cloud Run 콘솔에서 환경 변수 확인
- `gcloud run services describe yt-backend --region=$REGION` 명령으로 확인
- 필요시 `cloudbuild.yaml`에 `--update-env-vars` 추가

### 문제 5: 빌드 타임아웃

**증상**: 빌드가 20분 내에 완료되지 않음

**해결**:
- `cloudbuild.yaml`의 `timeout` 값 조정
- 빌드 머신 타입을 더 높은 사양으로 변경

---

## 📚 추가 리소스

- [Cloud Build 문서](https://cloud.google.com/build/docs)
- [Cloud Run 문서](https://cloud.google.com/run/docs)
- [GitHub Actions 문서](https://docs.github.com/en/actions)
- [Artifact Registry 문서](https://cloud.google.com/artifact-registry/docs)

---

## ✅ 체크리스트

배포 설정 완료 확인:

- [ ] GCP 서비스 계정 생성 및 권한 부여 완료
- [ ] Artifact Registry 저장소 생성 완료
- [ ] Cloud Build API 활성화 완료
- [ ] GitHub Secrets 설정 완료 (`GCP_PROJECT_ID`, `GCP_SA_KEY`)
- [ ] `cloudbuild.yaml` 파일 존재 확인
- [ ] `.github/workflows/deploy.yml` 파일 존재 확인
- [ ] 첫 번째 배포 테스트 완료

---

**🎉 설정이 완료되면 `main` 브랜치에 push하면 자동으로 배포됩니다!**

