from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Index
from sqlalchemy.sql import func

from app.core.database import Base


class Schedule(Base):
    __tablename__ = "SMU_SCHEDULES"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("SMU_USERS.id"), nullable=False, index=True, comment="사용자 ID")
    day = Column(String(10), nullable=False, comment="요일 (월/화/수/목/금)")
    start_time = Column(String(10), nullable=False, comment="시작 시간")
    end_time = Column(String(10), nullable=False, comment="종료 시간")
    subject = Column(String(100), nullable=False, index=True, comment="과목명")
    professor = Column(String(50), nullable=True, index=True, comment="교수명")
    room = Column(String(50), nullable=True, comment="강의실")
    color = Column(String(20), nullable=False, default="#3B82F6", comment="색상 코드")
    created_at = Column(DateTime, server_default=func.now(), comment="생성일시")
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), comment="수정일시")

    # 복합 인덱스: 과목+교수 조회 최적화
    __table_args__ = (
        Index('idx_schedule_subject_professor', 'subject', 'professor'),
    )
