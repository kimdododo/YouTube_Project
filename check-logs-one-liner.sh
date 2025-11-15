#!/bin/bash

# 한 줄 명령어로 최신 리비전의 시작 로그 확인
gcloud logging read \
  "resource.type=cloud_run_revision AND \
   resource.labels.service_name=yt-backend AND \
   resource.labels.location=asia-northeast3 AND \
   (textPayload=~\"Backend Startup\" OR textPayload=~\"Starting FastAPI\" OR textPayload=~\"Migration\" OR textPayload=~\"Uvicorn\" OR textPayload=~\"PORT\" OR textPayload=~\"Python\" OR severity>=ERROR)" \
  --project=swift-hangar-477802-t3 \
  --limit=100 \
  --format="table(timestamp,severity,textPayload)" \
  --order=asc

