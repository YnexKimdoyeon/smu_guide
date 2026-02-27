from typing import Optional
from pydantic import BaseModel
from datetime import datetime


class ScheduleBase(BaseModel):
    day: str
    start_time: str
    end_time: str
    subject: str
    professor: Optional[str] = None
    room: Optional[str] = None
    color: str = "#3B82F6"


class ScheduleCreate(ScheduleBase):
    pass


class ScheduleUpdate(BaseModel):
    day: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    subject: Optional[str] = None
    professor: Optional[str] = None
    room: Optional[str] = None
    color: Optional[str] = None


class ScheduleResponse(ScheduleBase):
    id: int
    user_id: int
    created_at: datetime

    class Config:
        from_attributes = True
