from typing import Optional
from pydantic import BaseModel
from datetime import datetime


class UserBase(BaseModel):
    student_id: str
    name: str
    department: str
    profile_image: Optional[str] = None


class UserCreate(UserBase):
    password: str


class UserLogin(BaseModel):
    student_id: str
    password: str


class UserResponse(UserBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class UserUpdate(BaseModel):
    name: Optional[str] = None
    department: Optional[str] = None
    profile_image: Optional[str] = None


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    user_id: Optional[int] = None
