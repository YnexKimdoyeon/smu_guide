from pydantic import BaseModel, Field, field_validator
from typing import Optional, List
from datetime import date, datetime


class DotoriInfo(BaseModel):
    """도토리 정보"""
    point: int
    nickname_color: Optional[str] = None
    title: Optional[str] = None
    can_attend_today: bool

    class Config:
        from_attributes = True


class AttendanceResponse(BaseModel):
    """출석 체크 응답"""
    success: bool
    message: str
    dotori_earned: int
    total_point: int


class PurchaseRequest(BaseModel):
    """구매 요청"""
    item_type: str = Field(..., description="nickname_color 또는 title")
    value: str = Field(..., description="색상 HEX 또는 칭호명")

    @field_validator('item_type')
    @classmethod
    def validate_item_type(cls, v):
        if v not in ['nickname_color', 'title']:
            raise ValueError('item_type은 nickname_color 또는 title이어야 합니다')
        return v

    @field_validator('value')
    @classmethod
    def validate_value(cls, v, info):
        if not v or not v.strip():
            raise ValueError('값을 입력해주세요')
        return v.strip()


class PurchaseResponse(BaseModel):
    """구매 응답"""
    success: bool
    message: str
    remaining_point: int
    item_type: Optional[str] = None
    item_value: Optional[str] = None


class DepartmentRanking(BaseModel):
    """학과 랭킹"""
    rank: int
    department: str
    total_dotori: int
    user_count: int


class RankingResponse(BaseModel):
    """랭킹 응답"""
    rankings: List[DepartmentRanking]
    my_department: Optional[DepartmentRanking] = None


# 도토리 선물 스키마
class GiftRequest(BaseModel):
    """선물 요청"""
    receiver_id: int = Field(..., description="받는 사람 ID (친구)")
    amount: int = Field(..., ge=1, description="선물할 도토리 개수")


class GiftResponse(BaseModel):
    """선물 응답"""
    success: bool
    message: str
    remaining_point: int


class ReceivedGift(BaseModel):
    """받은 선물"""
    id: int
    sender_id: int
    sender_name: str
    amount: int
    created_at: datetime

    class Config:
        from_attributes = True


class UnreadGiftsResponse(BaseModel):
    """읽지 않은 선물 목록"""
    gifts: List[ReceivedGift]
