from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Date
from sqlalchemy.sql import func

from app.core.database import Base


class CommuteSchedule(Base):
    """사용자별 등하교 스케줄"""
    __tablename__ = "SMU_COMMUTE_SCHEDULES"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("SMU_USERS.id"), nullable=False, comment="사용자 ID")
    day = Column(String(10), nullable=False, comment="요일: 월,화,수,목,금,토,일")
    commute_type = Column(String(10), nullable=False, comment="유형: 등교, 하교")
    time = Column(String(10), nullable=False, comment="시간 HH:MM")
    location = Column(String(100), nullable=True, comment="출발지/도착지")
    is_active = Column(Integer, default=1, comment="활성화 여부")
    created_at = Column(DateTime, server_default=func.now(), comment="생성일시")
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), comment="수정일시")


class CommuteGroup(Base):
    """매칭된 등하교 그룹"""
    __tablename__ = "SMU_COMMUTE_GROUPS"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    match_date = Column(Date, nullable=False, comment="매칭 날짜")
    day = Column(String(10), nullable=False, comment="요일")
    commute_type = Column(String(10), nullable=False, comment="유형: 등교, 하교")
    location = Column(String(100), nullable=True, comment="출발지/도착지")
    time_slot = Column(String(10), nullable=False, comment="시간대 HH:MM")
    created_at = Column(DateTime, server_default=func.now(), comment="생성일시")


class CommuteGroupMember(Base):
    """등하교 그룹 멤버"""
    __tablename__ = "SMU_COMMUTE_GROUP_MEMBERS"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    group_id = Column(Integer, ForeignKey("SMU_COMMUTE_GROUPS.id"), nullable=False, comment="그룹 ID")
    user_id = Column(Integer, ForeignKey("SMU_USERS.id"), nullable=False, comment="사용자 ID")
    joined_at = Column(DateTime, server_default=func.now(), comment="참여일시")


class CommuteChat(Base):
    """등하교 그룹 채팅 메시지"""
    __tablename__ = "SMU_COMMUTE_CHATS"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    group_id = Column(Integer, ForeignKey("SMU_COMMUTE_GROUPS.id"), nullable=False, comment="그룹 ID")
    user_id = Column(Integer, ForeignKey("SMU_USERS.id"), nullable=False, comment="발신자 ID")
    message = Column(String(1000), nullable=False, comment="메시지")
    created_at = Column(DateTime, server_default=func.now(), comment="발신일시")
