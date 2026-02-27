from typing import Optional, List
from pydantic import BaseModel
from datetime import datetime, date


class CommuteScheduleItem(BaseModel):
    """단일 스케줄 항목"""
    day: str  # 월,화,수,목,금,토,일
    commute_type: str  # 등교, 하교
    time: str  # HH:MM
    location: Optional[str] = None


class CommuteScheduleCreate(BaseModel):
    """스케줄 생성/수정 요청"""
    schedules: List[CommuteScheduleItem]


class CommuteScheduleResponse(BaseModel):
    """스케줄 응답"""
    id: int
    day: str
    commute_type: str
    time: str
    location: Optional[str] = None
    is_active: int

    class Config:
        from_attributes = True


class CommuteGroupMemberInfo(BaseModel):
    """그룹 멤버 정보"""
    user_id: int
    name: str
    department: str


class CommuteGroupResponse(BaseModel):
    """매칭된 그룹 응답"""
    id: int
    match_date: date
    day: str
    commute_type: str
    location: Optional[str] = None
    time_slot: str
    members: List[CommuteGroupMemberInfo]
    member_count: int

    class Config:
        from_attributes = True


class CommuteChatMessage(BaseModel):
    """채팅 메시지"""
    id: int
    group_id: int
    user_id: int
    sender: str
    message: str
    is_mine: bool
    created_at: datetime

    class Config:
        from_attributes = True


class CommuteChatSend(BaseModel):
    """채팅 메시지 전송"""
    group_id: int
    message: str
