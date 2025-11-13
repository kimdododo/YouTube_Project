from pydantic import BaseModel, EmailStr, Field


class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=64)
    email: EmailStr
    password: str = Field(..., min_length=6, max_length=72, description="비밀번호 (최대 72바이트)")


class UserOut(BaseModel):
    id: int
    username: str
    email: EmailStr
    is_verified: bool = False

    class Config:
        from_attributes = True


class EmailVerificationRequest(BaseModel):
    email: EmailStr
    code: str = Field(..., min_length=6, max_length=10, description="인증코드 (6자리 숫자)")


class EmailVerificationResponse(BaseModel):
    success: bool
    message: str


class ResendCodeRequest(BaseModel):
    email: EmailStr


class PasswordChangeRequest(BaseModel):
    current_password: str = Field(..., min_length=6, max_length=72, description="현재 비밀번호")
    new_password: str = Field(
        ...,
        min_length=10,
        max_length=72,
        description="새 비밀번호 (영문, 숫자, 특수문자 중 2종류 이상 조합, 최소 10자)"
    )
