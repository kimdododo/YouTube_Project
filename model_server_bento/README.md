# SimCSE BentoML Server

이 디렉터리는 기존 FastAPI 기반 `kimdododo/simcse-serve` 컨테이너를 BentoML 서비스로
대체하기 위한 구현입니다. Cloud Run에 배포되는 HTTP 계약은 이전 서버와 동일하게 유지됩니다.

## 엔드포인트

| Method | Path            | 설명                                  |
| ------ | --------------- | ------------------------------------- |
| GET    | `/health`       | 헬스 체크, 모델/토크나이저 경로 반환 |
| POST   | `/predict`      | 단일 텍스트 임베딩 (`{"text": ...}`) |
| POST   | `/predict/batch`| 배치 임베딩 (`{"texts": [...]}`)     |
| POST   | `/similarity`   | 두 문장 코사인 유사도 (`text1/text2`)|

응답 JSON 구조 역시 FastAPI 서버와 동일하게 유지됩니다. (예: `/predict` → `{"vector": [[...]], "dim": 768}`).

## 로컬 개발

1. **모델 복사**

   ```
   model_server_bento/
     models/simcse/model.onnx
     models/simcse/tokenizer/...
   ```

   모델/토크나이저를 GCS에서 내려받아 위 경로에 배치합니다.

2. **의존성 설치 & 로컬 실행**

   ```bash
   cd model_server_bento
   python -m venv .venv && source .venv/bin/activate
   pip install -r requirements.txt
   bentoml serve service:svc --reload --port 8080
   ```

3. **테스트**

   ```bash
   curl -X POST http://localhost:8080/predict \
     -H "Content-Type: application/json" \
     -d '{"text": "여행 영상 추천"}'

   curl -X POST http://localhost:8080/similarity \
     -H "Content-Type: application/json" \
     -d '{"text1": "제주도 여행", "text2": "부산 해운대"}'
   ```

## Bento 패키지 & 컨테이너

```bash
cd model_server_bento
bentoml build
bentoml containerize simcse_onnx_service:latest -t kimdododo/simcse-serve-bento:latest
docker push kimdododo/simcse-serve-bento:latest
```

Cloud Run 배포:

```bash
gcloud run deploy simcse-server \
  --image docker.io/kimdododo/simcse-serve-bento:latest \
  --region asia-northeast3 \
  --platform managed \
  --allow-unauthenticated \
  --port 8080 \
  --memory 2Gi \
  --cpu 2 \
  --service-account=github-actions@swift-hangar-477802-t3.iam.gserviceaccount.com
```

필요 시 `MODEL_PATH`, `TOKENIZER_PATH`, `MAX_SEQ_LENGTH` 등의 환경변수를 Cloud Run에
추가하여 다른 모델 경로를 사용할 수 있습니다.

## Cloud Run 서비스 URL & 클라이언트 설정

- 현재 배포된 Cloud Run 엔드포인트:  
  `https://simcse-server-480607763463.asia-northeast3.run.app`

- FastAPI 백엔드 `.env`(또는 Cloud Run)에는 아래와 같이 설정해, 상세 페이지 API가 이 Bento 서비스를 호출하도록 합니다.

  ```
  BENTO_BASE_URL=https://simcse-server-480607763463.asia-northeast3.run.app
  ```

- 필요 시 프런트엔드도 동일 값을 읽어 직접 호출할 수 있습니다.

## 모델 자산을 GCS에서 로드하기

모델 파일은 로컬 Git에 포함하지 않고 Cloud Storage 버킷(예: `gs://yt-model-server/bento-models/`)에서 내려받아 사용합니다.

1. 버킷 업로드 예시
   ```bash
   gsutil cp -r models/simcse gs://yt-model-server/bento-models/simcse
   gsutil cp -r models/sentiment gs://yt-model-server/bento-models/sentiment
   ```

2. 빌드/배포 환경 변수
   - `EMBED_MODEL_DIR=gs://yt-model-server/bento-models/simcse`
   - `SENTIMENT_MODEL_DIR=gs://yt-model-server/bento-models/sentiment`
   - `ASPECT_MODEL_DIR=gs://yt-model-server/bento-models/aspect` (필요 시)

3. GitHub Actions 워크플로와 Cloud Run 배포 명령 모두 이 환경 변수를 사용하도록 구성되어 있으며, `service.py`는 GCS 경로를 감지해 `/tmp/bento_model_cache`에 자동 캐시합니다.



