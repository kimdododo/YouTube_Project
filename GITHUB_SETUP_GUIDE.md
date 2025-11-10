# 🚀 GitHub 자동 배포 설정 가이드

GitHub 레포지토리에 코드를 push하면 자동으로 Cloud Run에 배포됩니다.

## 📋 사전 준비

1. ✅ `cloudbuild.yaml` 파일이 프로젝트 루트에 있음
2. ✅ `.github/workflows/deploy.yml` 파일이 있음
3. ✅ GCP 프로젝트 ID: `eastern-gravity-473301-n8`

---

## 1️⃣ GitHub 레포지토리에 코드 Push

### 로컬에서 GitHub에 연결

```bash
# 현재 디렉토리에서
cd C:\Users\USER\OneDrive\Desktop\데이터수집

# Git 초기화 (아직 안 했다면)
git init

# GitHub 레포지토리 추가 (HTTP URL 사용)
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git

# 또는 이미 있다면 확인
git remote -v

# 모든 파일 추가
git add .

# 커밋
git commit -m "Add CI/CD configuration for Cloud Run auto-deployment"

# main 브랜치로 push
git branch -M main
git push -u origin main
```

### 기존 레포지토리가 있다면

```bash
# 현재 변경사항 확인
git status

# 파일 추가
git add cloudbuild.yaml .github/

# 커밋
git commit -m "Add Cloud Build and GitHub Actions configuration"

# Push
git push origin main
```

---

## 2️⃣ GCP 서비스 계정 생성 및 키 다운로드

### Cloud Shell에서 실행

```bash
# 프로젝트 ID 설정
export PROJECT_ID="eastern-gravity-473301-n8"

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

# 키 파일 내용 확인 (전체 JSON 복사)
cat github-actions-key.json
```

**⚠️ 중요**: `github-actions-key.json` 파일의 **전체 내용**을 복사해두세요!

---

## 3️⃣ Artifact Registry 저장소 생성

```bash
# Artifact Registry 저장소 생성
gcloud artifacts repositories create cloud-run-source-deploy \
  --repository-format=docker \
  --location=asia-northeast3 \
  --project=$PROJECT_ID
```

---

## 4️⃣ Cloud Build API 활성화

```bash
# Cloud Build API 활성화
gcloud services enable cloudbuild.googleapis.com \
  --project=$PROJECT_ID
```

---

## 5️⃣ GitHub Secrets 설정

### GitHub 웹사이트에서 설정

1. **GitHub 레포지토리로 이동**
   - `https://github.com/YOUR_USERNAME/YOUR_REPO_NAME`

2. **Settings 메뉴 클릭**
   - 레포지토리 상단 메뉴에서 "Settings" 클릭

3. **Secrets and variables → Actions 이동**
   - 왼쪽 사이드바에서 "Secrets and variables" → "Actions" 클릭

4. **New repository secret 클릭**

5. **첫 번째 Secret 추가: `GCP_PROJECT_ID`**
   - Name: `GCP_PROJECT_ID`
   - Secret: `eastern-gravity-473301-n8`
   - "Add secret" 클릭

6. **두 번째 Secret 추가: `GCP_SA_KEY`**
   - Name: `GCP_SA_KEY`
   - Secret: `github-actions-key.json` 파일의 **전체 내용** (JSON 전체)
   - "Add secret" 클릭

### Secret 값 확인 방법

```bash
# Cloud Shell에서 키 파일 내용 확인
cat github-actions-key.json

# 또는 다운로드 후 로컬에서 확인
# 파일을 열어서 전체 내용 복사 (중괄호 포함)
```

**예시 Secret 값 형식:**
```json
{
  "type": "service_account",
  "project_id": "eastern-gravity-473301-n8",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "github-actions@eastern-gravity-473301-n8.iam.gserviceaccount.com",
  ...
}
```

---

## 6️⃣ GitHub Actions 워크플로우 확인

### 워크플로우 파일 경로 확인

파일이 다음 경로에 있어야 합니다:
```
.github/workflows/deploy.yml
```

### 워크플로우 트리거 조건 확인

현재 설정된 트리거:
- ✅ `main` 또는 `master` 브랜치에 push
- ✅ `backend/` 디렉토리 변경
- ✅ `cloudbuild.yaml` 변경
- ✅ `.github/workflows/deploy.yml` 변경
- ✅ 수동 실행 가능 (workflow_dispatch)

---

## 7️⃣ 첫 배포 테스트

### 방법 1: 작은 변경사항으로 테스트

```bash
# README 파일에 주석 추가 (테스트용)
echo "# Auto-deployment enabled" >> README.md

git add README.md
git commit -m "Test: Trigger auto-deployment"
git push origin main
```

### 방법 2: GitHub Actions에서 수동 실행

1. GitHub 레포지토리 → **Actions** 탭 클릭
2. 왼쪽에서 **"Deploy to Cloud Run"** 워크플로우 선택
3. **"Run workflow"** 버튼 클릭
4. 브랜치 선택 (main) → **"Run workflow"** 클릭

---

## 8️⃣ 배포 상태 확인

### GitHub Actions에서 확인

1. **Actions 탭** → 최근 워크플로우 실행 클릭
2. 각 단계별 로그 확인:
   - ✅ Checkout code
   - ✅ Authenticate to Google Cloud
   - ✅ Set up Cloud SDK
   - ✅ Configure Docker for GCR
   - ✅ Submit build to Cloud Build
   - ✅ Build Summary

### Cloud Build에서 확인

1. **GCP 콘솔** → Cloud Build → Builds
   - URL: `https://console.cloud.google.com/cloud-build/builds?project=eastern-gravity-473301-n8`

2. 빌드 로그에서 확인:
   - 테스트 단계
   - 이미지 빌드
   - 이미지 푸시
   - Cloud Run 배포

### Cloud Run에서 확인

1. **GCP 콘솔** → Cloud Run → Services
   - URL: `https://console.cloud.google.com/run?project=eastern-gravity-473301-n8`

2. `yt-backend` 서비스의 최신 revision 확인

---

## 🔍 트러블슈팅

### 문제 1: "Permission denied" 오류

**원인**: 서비스 계정 권한 부족

**해결**:
```bash
# 권한 다시 확인
gcloud projects get-iam-policy eastern-gravity-473301-n8 \
  --flatten="bindings[].members" \
  --filter="bindings.members:github-actions@eastern-gravity-473301-n8.iam.gserviceaccount.com"
```

### 문제 2: "Artifact Registry not found" 오류

**원인**: Artifact Registry 저장소가 없음

**해결**:
```bash
# 저장소 생성
gcloud artifacts repositories create cloud-run-source-deploy \
  --repository-format=docker \
  --location=asia-northeast3 \
  --project=eastern-gravity-473301-n8
```

### 문제 3: "Secret not found" 오류

**원인**: GitHub Secrets가 제대로 설정되지 않음

**해결**:
1. GitHub → Settings → Secrets and variables → Actions
2. `GCP_PROJECT_ID`와 `GCP_SA_KEY` 확인
3. Secret 값이 올바른지 확인 (특히 `GCP_SA_KEY`는 전체 JSON)

### 문제 4: 워크플로우가 트리거되지 않음

**원인**: 파일 경로나 브랜치 이름 불일치

**해결**:
1. `.github/workflows/deploy.yml` 파일 경로 확인
2. 브랜치 이름 확인 (`main` 또는 `master`)
3. `paths` 필터 확인 (변경된 파일이 포함되는지)

---

## ✅ 체크리스트

배포 설정 완료 확인:

- [ ] GitHub 레포지토리에 코드 push 완료
- [ ] GCP 서비스 계정 생성 완료
- [ ] 서비스 계정에 필요한 권한 부여 완료
- [ ] Artifact Registry 저장소 생성 완료
- [ ] Cloud Build API 활성화 완료
- [ ] GitHub Secrets 설정 완료 (`GCP_PROJECT_ID`, `GCP_SA_KEY`)
- [ ] `.github/workflows/deploy.yml` 파일 존재 확인
- [ ] `cloudbuild.yaml` 파일 존재 확인
- [ ] 첫 배포 테스트 완료

---

## 📚 추가 리소스

- [GitHub Actions 문서](https://docs.github.com/en/actions)
- [Cloud Build 문서](https://cloud.google.com/build/docs)
- [Cloud Run 문서](https://cloud.google.com/run/docs)

---

**🎉 설정이 완료되면 `main` 브랜치에 push하면 자동으로 배포됩니다!**

