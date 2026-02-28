from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Text
from sqlalchemy.sql import func

from app.core.database import Base


class UserBlock(Base):
    """사용자 차단"""
    __tablename__ = "SMU_USER_BLOCKS"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("SMU_USERS.id"), nullable=False, index=True, comment="차단한 사용자 ID")
    blocked_user_id = Column(Integer, ForeignKey("SMU_USERS.id"), nullable=False, index=True, comment="차단된 사용자 ID")
    created_at = Column(DateTime, server_default=func.now(), comment="차단일시")


class UserReport(Base):
    """사용자 신고"""
    __tablename__ = "SMU_USER_REPORTS"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    reporter_id = Column(Integer, ForeignKey("SMU_USERS.id"), nullable=False, index=True, comment="신고자 ID")
    reported_user_id = Column(Integer, ForeignKey("SMU_USERS.id"), nullable=False, index=True, comment="피신고자 ID")
    reason = Column(String(50), nullable=False, comment="신고 사유")
    detail = Column(Text, nullable=True, comment="상세 내용")
    message_id = Column(Integer, nullable=True, comment="관련 메시지 ID")
    room_type = Column(String(20), nullable=True, comment="채팅방 유형: chat, random, commute")
    status = Column(String(20), nullable=False, default="pending", comment="처리 상태: pending, reviewed, resolved")
    created_at = Column(DateTime, server_default=func.now(), comment="신고일시")
