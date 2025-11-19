# Model Server

FastAPI 기반 RAG/요약 전용 모델 서버입니다. 기존 백엔드(`backend/`)와 분리되어 Cloud Run 등에서 독립적으로 배포할 수 있습니다.

## 구성

```
model_server/
├── main.py             # FastAPI 앱 진입점
├── requirements.txt    # 모델 서버 패키지 목록 (backend requirements 재사용)
└── README.md           # 이 문서
```

`main.py`는 동일 레포지토리의 `backend/` 경로를 `PYTHONPATH`에 추가하여 기존 DB 모델(`app.models.*`)과 RAG 파이프라인(`app.rag.*`)을 재사용합니다.

## 실행

```bash
cd model_server
pip install -r requirements.txt
python main.py  # 또는 uvicorn main:app --host 0.0.0.0 --port 8200
```

### 필수 환경 변수

모델 서버도 DB에 직접 접근하므로 백엔드와 동일한 `.env` 값이 필요합니다.

```env
DB_HOST=...
DB_PORT=...
DB_USER=...
DB_PASSWORD=...
DB_NAME=...
```

추가로 RAG 파이프라인에서 사용하는 OpenAI/LLM 관련 변수들도 동일하게 설정하세요.

## API

- `POST /summaries/one-line`  
  요청: `{"video_id": "<유튜브 영상 ID>"}`  
  응답: `{"video_id": "...", "summary_type": "one_line_rag", "summary": "..."}`

## 배포

1. `backend/`와 동일한 소스 트리를 포함한 도커 이미지를 빌드합니다.
2. 진입점을 `model_server/main.py` 또는 `uvicorn model_server.main:app` 으로 지정합니다.
3. 백엔드 서비스에는 `MODEL_SERVER_URL` 환경 변수로 모델 서버의 호스트를 알려주어야 합니다.

