from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Date, Boolean
from sqlalchemy.sql import func

from app.core.database import Base


class DepartmentRankingCache(Base):
    """학과별 도토리 랭킹 캐시 테이블 (하루 1회 갱신)"""
    __tablename__ = "SMU_DEPARTMENT_RANKINGS"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    cache_date = Column(Date, nullable=False, index=True, comment="캐시 날짜")
    rank = Column(Integer, nullable=False, comment="순위")
    department = Column(String(100), nullable=False, comment="학과명")
    total_dotori = Column(Integer, default=0, comment="총 도토리 수")
    user_count = Column(Integer, default=0, comment="유저 수")
    created_at = Column(DateTime, server_default=func.now(), comment="생성일시")


class DotoriGift(Base):
    """도토리 선물 테이블"""
    __tablename__ = "SMU_DOTORI_GIFTS"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    sender_id = Column(Integer, ForeignKey("SMU_USERS.id"), nullable=False, comment="보내는 사람 ID")
    receiver_id = Column(Integer, ForeignKey("SMU_USERS.id"), nullable=False, comment="받는 사람 ID")
    amount = Column(Integer, nullable=False, comment="선물 도토리 개수")
    is_read = Column(Boolean, default=False, comment="수신자 확인 여부")
    created_at = Column(DateTime, server_default=func.now(), comment="생성일시")
