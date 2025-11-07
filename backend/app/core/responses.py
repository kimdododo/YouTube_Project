from pydantic import BaseModel
from typing import Any, Optional


class Envelope(BaseModel):
    success: bool
    data: Optional[Any] = None
    error: Optional[str] = None


def ok(data: Any) -> Envelope:
    return Envelope(success=True, data=data, error=None)


def fail(message: str) -> Envelope:
    return Envelope(success=False, data=None, error=message)


