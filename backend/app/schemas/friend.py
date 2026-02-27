from typing import Optional
from pydantic import BaseModel
from datetime import datetime


class FriendBase(BaseModel):
    friend_id: int


class FriendCreate(FriendBase):
    pass


class FriendUpdate(BaseModel):
    status: str  # pending, accepted, rejected


class FriendResponse(BaseModel):
    id: int
    user_id: int
    friend_id: int
    status: str
    created_at: datetime
    friend_name: Optional[str] = None
    friend_student_id: Optional[str] = None
    friend_department: Optional[str] = None

    class Config:
        from_attributes = True


class FreeTimeSlot(BaseModel):
    day: str
    start_time: str
    end_time: str
