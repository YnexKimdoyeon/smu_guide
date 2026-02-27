from sqlalchemy import Column, Integer, String, DateTime, Index
from sqlalchemy.sql import func

from app.core.database import Base


class PhoneEntry(Base):
    __tablename__ = "SMU_PHONE_DIRECTORY"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    department = Column(String(100), nullable=False, index=True, comment="부서명")
    name = Column(String(100), nullable=False, index=True, comment="담당자/서비스명")
    phone = Column(String(20), nullable=False, index=True, comment="전화번호")
    extension = Column(String(10), nullable=True, comment="내선번호")
    created_at = Column(DateTime, server_default=func.now(), comment="생성일시")

    __table_args__ = (
        Index('ix_phone_dept_name', 'department', 'name'),
    )
