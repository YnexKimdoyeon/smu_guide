from typing import Optional, List
from pydantic import BaseModel
from datetime import datetime


class QuickRoomCreate(BaseModel):
    """방 생성 요청"""
    title: str
    departure: str
    destination: str
    depart_time: str  # HH:MM


class QuickRoomMemberInfo(BaseModel):
    """방 멤버 정보"""
    user_id: int
    name: str
    department: str
    is_confirmed: int = 0

    class Config:
        from_attributes = True


class QuickRoomResponse(BaseModel):
    """방 응답"""
    id: int
    creator_id: int
    title: str
    departure: str
    destination: str
    depart_time: str
    max_members: int
    is_active: int
    current_members: int
    members: List[QuickRoomMemberInfo]
    is_joined: bool = False
    created_at: datetime

    class Config:
        from_attributes = True


class QuickRoomChatMessage(BaseModel):
    """채팅 메시지"""
    id: int
    room_id: int
    user_id: int
    sender: str
    message: str
    is_mine: bool
    is_system: int = 0
    created_at: datetime

    class Config:
        from_attributes = True


class QuickRoomChatSend(BaseModel):
    """채팅 메시지 전송"""
    room_id: int
    message: str
