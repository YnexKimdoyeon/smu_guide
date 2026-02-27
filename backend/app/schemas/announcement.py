from typing import Optional
from pydantic import BaseModel
from datetime import datetime


class AnnouncementBase(BaseModel):
    title: str
    content: Optional[str] = None
    category: str = "일반"


class AnnouncementCreate(AnnouncementBase):
    notice_no: Optional[int] = None
    writer: Optional[str] = None
    notice_date: Optional[str] = None
    views: Optional[int] = 0
    external_url: Optional[str] = None


class AnnouncementUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    category: Optional[str] = None
    is_new: Optional[int] = None


class AnnouncementResponse(BaseModel):
    id: int
    notice_no: Optional[int] = None
    title: str
    content: Optional[str] = None
    category: str
    writer: Optional[str] = None
    notice_date: Optional[str] = None
    views: int = 0
    external_url: Optional[str] = None
    is_new: int
    created_at: datetime

    class Config:
        from_attributes = True
