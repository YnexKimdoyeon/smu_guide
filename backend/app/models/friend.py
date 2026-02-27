from sqlalchemy import Column, Integer, String, ForeignKey, DateTime
from sqlalchemy.sql import func

from app.core.database import Base


class Friend(Base):
    __tablename__ = "SMU_FRIENDS"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("SMU_USERS.id"), nullable=False, comment="사용자 ID")
    friend_id = Column(Integer, ForeignKey("SMU_USERS.id"), nullable=False, comment="친구 ID")
    status = Column(String(20), nullable=False, default="pending", comment="상태 (pending/accepted/rejected)")
    created_at = Column(DateTime, server_default=func.now(), comment="생성일시")
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), comment="수정일시")
