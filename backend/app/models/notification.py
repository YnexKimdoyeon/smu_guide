"""
알림 추적 모델
"""
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.core.database import Base


class AppLastViewed(Base):
    """앱별 마지막 조회 시간"""
    __tablename__ = "SMU_APP_LAST_VIEWED"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("SMU_USERS.id"), nullable=False)
    app_id = Column(String(50), nullable=False)  # 앱 ID (friends, community, chat 등)
    last_viewed_at = Column(DateTime, server_default=func.now())
