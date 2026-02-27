from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.sql import func

from app.core.database import Base


class User(Base):
    __tablename__ = "SMU_USERS"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    student_id = Column(String(20), unique=True, index=True, nullable=False, comment="학번")
    password = Column(String(255), nullable=False, comment="비밀번호 해시")
    name = Column(String(50), nullable=False, comment="이름")
    department = Column(String(100), nullable=False, comment="학과")
    profile_image = Column(String(500), nullable=True, comment="프로필 이미지 URL")
    created_at = Column(DateTime, server_default=func.now(), comment="생성일시")
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), comment="수정일시")
