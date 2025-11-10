# ✅ 자동 배포 설정 체크리스트

## 📋 필요한 정보

### 1️⃣ GCP 프로젝트 정보
- [ ] **GCP 프로젝트 ID**: `_________________`
  ```bash
  # 확인 방법
  gcloud config get-value project
  ```

### 2️⃣ 현재 Cloud Run 서비스 설정 확인

현재 `yt-backend` 서비스의 설정을 확인하고 아래 정보를 알려주세요:

```bash
# 현재 서비스 설정 확인
gcloud run services describe yt-backend \
  --region=asia-northeast3 \
  --format=yaml
```

**확인할 항목:**
- [ ] **메모리**: 현재 `____Gi` (예: 2Gi, 4Gi)
- [ ] **CPU**: 현재 `____` (예: 1, 2, 4)
- [ ] **최대 인스턴스**: 현재 `____` (예: 10, 20)
- [ ] **최소 인스턴스**: 현재 `____` (예: 0, 1)
- [ ] **타임아웃**: 현재 `____`초 (예: 300, 600)

### 3️⃣ 환경 변수 목록

현재 Cloud Run에 설정된 환경 변수 목록:

```bash
# 환경 변수 확인
gcloud run services describe yt-backend \
  --region=asia-northeast3 \
  --format="value(spec.template.spec.containers[0].env)"
```

**필수 환경 변수 (코드에서 확인됨):**
- [ ] `DB_USER` - 데이터베이스 사용자명
- [ ] `DB_PASSWORD` - 데이터베이스 비밀번호 (Secret Manager 사용 여부 확인)
- [ ] `DB_HOST` - 데이터베이스 호스트 (예: `/cloudsql/PROJECT_ID:REGION:INSTANCE_NAME`)
- [ ] `DB_PORT` - 데이터베이스 포트 (기본값: 3306)
- [ ] `DB_NAME` - 데이터베이스 이름 (기본값: yt)
- [ ] `JWT_SECRET` - JWT 토큰 서명 키
- [ ] `JWT_ALGO` - JWT 알고리즘 (기본값: HS256)
- [ ] `JWT_ACCESS_MINUTES` - JWT 만료 시간 (기본값: 60)
- [ ] `REDIS_URL` - Redis 연결 URL
- [ ] `FRONTEND_URL` - 프론트엔드 URL (CORS용, 기본값: "*")

**추가 환경 변수가 있다면:**
- [ ] `_________________` = `_________________`
- [ ] `_________________` = `_________________`

### 4️⃣ Secrets 목록

Cloud Run에서 Secret Manager를 통해 사용하는 secrets:

```bash
# Secrets 확인
gcloud run services describe yt-backend \
  --region=asia-northeast3 \
  --format="value(spec.template.spec.containers[0].env)" | grep -i secret
```

**Secrets 목록:**
- [ ] Secret 이름: `_________________` → 환경 변수: `_________________`
- [ ] Secret 이름: `_________________` → 환경 변수: `_________________`

### 5️⃣ Artifact Registry 저장소 확인

```bash
# 저장소 확인
gcloud artifacts repositories list --location=asia-northeast3
```

- [ ] **저장소 이름**: `cloud-run-source-deploy` (없으면 생성 필요)
- [ ] **저장소 형식**: `docker`
- [ ] **리전**: `asia-northeast3`

### 6️⃣ GitHub 저장소 정보

- [ ] **GitHub 저장소 URL**: `https://github.com/_________________/_________________`
- [ ] **기본 브랜치**: `main` 또는 `master`?

### 7️⃣ Cloud SQL 연결 정보 (있는 경우)

- [ ] **Cloud SQL 인스턴스 연결 이름**: `PROJECT_ID:REGION:INSTANCE_NAME`
  ```bash
  # 확인 방법
  gcloud sql instances describe INSTANCE_NAME --format="value(connectionName)"
  ```

---

## 🔧 설정 전 확인 사항

### 이미 설정된 것들
- [x] `cloudbuild.yaml` 파일 생성 완료
- [x] `.github/workflows/deploy.yml` 파일 생성 완료
- [x] `DEPLOYMENT_GUIDE.md` 가이드 문서 생성 완료

### 설정해야 할 것들
- [ ] GCP 서비스 계정 생성 및 권한 부여
- [ ] Artifact Registry 저장소 생성 (없는 경우)
- [ ] Cloud Build API 활성화
- [ ] GitHub Secrets 설정 (`GCP_PROJECT_ID`, `GCP_SA_KEY`)

---

## 📝 정보 수집 스크립트

아래 스크립트를 실행하여 현재 설정을 한 번에 확인할 수 있습니다:

```bash
#!/bin/bash

PROJECT_ID=$(gcloud config get-value project)
REGION="asia-northeast3"
SERVICE_NAME="yt-backend"

echo "=== GCP 프로젝트 정보 ==="
echo "프로젝트 ID: $PROJECT_ID"
echo ""

echo "=== Cloud Run 서비스 설정 ==="
gcloud run services describe $SERVICE_NAME \
  --region=$REGION \
  --format="table(
    spec.template.spec.containers[0].resources.limits.memory,
    spec.template.spec.containers[0].resources.limits.cpu,
    spec.template.spec.containerConcurrency,
    spec.template.spec.timeoutSeconds
  )"
echo ""

echo "=== 환경 변수 목록 ==="
gcloud run services describe $SERVICE_NAME \
  --region=$REGION \
  --format="value(spec.template.spec.containers[0].env[].name)" | sort
echo ""

echo "=== Secrets 목록 ==="
gcloud run services describe $SERVICE_NAME \
  --region=$REGION \
  --format="value(spec.template.spec.containers[0].env[].valueSource.secretKeyRef.name)" | grep -v "^$" | sort -u
echo ""

echo "=== Artifact Registry 저장소 ==="
gcloud artifacts repositories list --location=$REGION --format="table(name,format,location)"
echo ""

echo "=== Cloud Build API 상태 ==="
gcloud services list --enabled --filter="name:cloudbuild.googleapis.com"
```

---

## 🚀 다음 단계

위 정보를 모두 수집한 후:

1. **`cloudbuild.yaml` 검토**: 메모리, CPU 등 리소스 설정이 현재 값과 일치하는지 확인
2. **환경 변수/Secrets 확인**: 자동 배포 시 기존 설정이 유지되는지 확인
3. **GitHub Secrets 설정**: `GCP_PROJECT_ID`와 `GCP_SA_KEY` 추가
4. **첫 배포 테스트**: `main` 브랜치에 작은 변경사항 push하여 테스트

---

## ⚠️ 주의사항

1. **환경 변수 유지**: `gcloud run deploy`는 기본적으로 기존 환경 변수를 유지하지만, 명시적으로 지정한 리소스 설정(메모리, CPU 등)은 업데이트됩니다.

2. **Secrets 유지**: Secret Manager를 통해 설정한 secrets도 자동으로 유지됩니다.

3. **첫 배포 시**: 기존 서비스가 없으면 새로 생성되며, 기본 설정으로 시작됩니다.

4. **롤백 방법**: 배포 실패 시 이전 revision으로 롤백 가능:
   ```bash
   gcloud run services update-traffic yt-backend \
     --to-revisions=PREVIOUS_REVISION=100 \
     --region=asia-northeast3
   ```

