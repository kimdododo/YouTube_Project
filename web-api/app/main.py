from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.settings import get_settings
from app.core.redis_client import get_redis
from app.routers import channels, trends, videos, ml_test

app = FastAPI(title="Web API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def on_startup() -> None:
    # Initialize Redis connection
    settings = get_settings()
    await get_redis(settings)


@app.get("/ping")
async def ping():
    return {"status": "ok"}


app.include_router(channels.router)
app.include_router(trends.router)
app.include_router(videos.router)
app.include_router(ml_test.router)


