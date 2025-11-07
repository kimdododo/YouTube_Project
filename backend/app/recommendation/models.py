"""
추천 시스템에서 사용되는 DTO/Pydantic 모델 정의
프런트가 바로 사용할 수 있는 필드만 노출한다.
"""
from pydantic import BaseModel, Field
from typing import Optional


class RankedVideo(BaseModel):
    """추천 결과 한 건"""
    video_id: str
    title: str
    channel_id: str
    score: float = Field(..., description="최종 추천 점수")
    pos_ratio: Optional[float] = None
    topic_id: Optional[int] = None


class RankedVideoList(BaseModel):
    videos: list[RankedVideo]
    total: int
    message: Optional[str] = None


