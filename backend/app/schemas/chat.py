from typing import Optional, List
from pydantic import BaseModel
from datetime import datetime


class ChatRoomBase(BaseModel):
    name: str
    description: Optional[str] = None


class ChatRoomCreate(ChatRoomBase):
    pass


class ChatRoomResponse(ChatRoomBase):
    id: int
    room_type: str = "subject"
    subject_key: Optional[str] = None
    created_by: Optional[int] = None
    created_at: datetime
    participants: int = 0
    last_message: Optional[str] = None
    last_time: Optional[str] = None

    class Config:
        from_attributes = True


class ChatMessageBase(BaseModel):
    message: str


class ChatMessageCreate(ChatMessageBase):
    room_id: int


class ChatMessageResponse(ChatMessageBase):
    id: int
    room_id: int
    user_id: int
    sender: str
    is_mine: bool = False
    created_at: datetime

    class Config:
        from_attributes = True


# 랜덤 채팅 스키마
class RandomChatStatus(BaseModel):
    status: str  # waiting, matched, none
    room_id: Optional[int] = None
    partner_name: Optional[str] = None


class RandomChatMessageCreate(BaseModel):
    room_id: int
    message: str


class RandomChatMessageResponse(BaseModel):
    id: int
    room_id: int
    message: str
    sender: str
    is_mine: bool = False
    created_at: datetime

    class Config:
        from_attributes = True
