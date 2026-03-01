"""
과팅 모델
"""
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base
import enum


class MeetingStatus(str, enum.Enum):
    OPEN = "open"  # 모집중
    CLOSED = "closed"  # 마감
    MATCHED = "matched"  # 매칭완료


class Meeting(Base):
    """과팅 게시글"""
    __tablename__ = "SMU_MEETINGS"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("SMU_USERS.id"), nullable=False)
    department = Column(String(100), nullable=False)  # 과
    member_count = Column(Integer, nullable=False)  # 인원수
    description = Column(Text, nullable=True)  # 설명
    status = Column(String(20), default="open")  # open, closed, matched
    matched_application_id = Column(Integer, ForeignKey("SMU_MEETING_APPLICATIONS.id"), nullable=True)
    chat_room_id = Column(Integer, ForeignKey("SMU_CHAT_ROOMS.id"), nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # 관계
    user = relationship("User", backref="meetings")
    applications = relationship("MeetingApplication", back_populates="meeting", foreign_keys="MeetingApplication.meeting_id", cascade="all, delete-orphan")


class MeetingApplication(Base):
    """과팅 신청"""
    __tablename__ = "SMU_MEETING_APPLICATIONS"

    id = Column(Integer, primary_key=True, index=True)
    meeting_id = Column(Integer, ForeignKey("SMU_MEETINGS.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("SMU_USERS.id"), nullable=False)
    department = Column(String(100), nullable=False)  # 신청자 과
    member_count = Column(Integer, nullable=False)  # 인원수
    message = Column(Text, nullable=True)  # 메시지
    is_matched = Column(Integer, default=0)  # 매칭 여부
    created_at = Column(DateTime, server_default=func.now())

    # 관계
    meeting = relationship("Meeting", back_populates="applications", foreign_keys=[meeting_id])
    user = relationship("User", backref="meeting_applications")
