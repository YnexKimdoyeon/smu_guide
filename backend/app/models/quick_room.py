from sqlalchemy import Column, Integer, String, ForeignKey, DateTime
from sqlalchemy.sql import func

from app.core.database import Base


class QuickRoom(Base):
    """급하게 매칭 방"""
    __tablename__ = "SMU_QUICK_ROOMS"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    creator_id = Column(Integer, ForeignKey("SMU_USERS.id"), nullable=False, comment="방장 ID")
    title = Column(String(200), nullable=False, comment="방 제목")
    departure = Column(String(100), nullable=False, comment="출발지")
    destination = Column(String(100), nullable=False, comment="도착지")
    depart_time = Column(String(10), nullable=False, comment="출발 시간 HH:MM")
    max_members = Column(Integer, default=4, comment="최대 인원")
    is_active = Column(Integer, default=1, comment="활성 여부: 1=활성, 0=마감")
    created_at = Column(DateTime, server_default=func.now(), comment="생성일시")


class QuickRoomMember(Base):
    """급하게 매칭 방 멤버"""
    __tablename__ = "SMU_QUICK_ROOM_MEMBERS"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    room_id = Column(Integer, ForeignKey("SMU_QUICK_ROOMS.id"), nullable=False, comment="방 ID")
    user_id = Column(Integer, ForeignKey("SMU_USERS.id"), nullable=False, comment="사용자 ID")
    is_confirmed = Column(Integer, default=0, comment="참석 확인 여부: 0=미확인, 1=확인")
    joined_at = Column(DateTime, server_default=func.now(), comment="참여일시")


class QuickRoomChat(Base):
    """급하게 매칭 방 채팅"""
    __tablename__ = "SMU_QUICK_ROOM_CHATS"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    room_id = Column(Integer, ForeignKey("SMU_QUICK_ROOMS.id"), nullable=False, comment="방 ID")
    user_id = Column(Integer, ForeignKey("SMU_USERS.id"), nullable=False, comment="발신자 ID")
    message = Column(String(1000), nullable=False, comment="메시지")
    is_system = Column(Integer, default=0, comment="시스템 메시지 여부")
    created_at = Column(DateTime, server_default=func.now(), comment="발신일시")
