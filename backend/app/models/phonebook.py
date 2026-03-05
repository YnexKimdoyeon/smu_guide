from sqlalchemy import Column, Integer, String, DateTime, Index
from sqlalchemy.sql import func

from app.core.database import Base


class PhoneEntry(Base):
    __tablename__ = "SMU_PHONE_DIRECTORY"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    category = Column(String(20), nullable=False, default="dept", index=True, comment="카테고리: dept=학과, admin=행정")
    department = Column(String(100), nullable=False, index=True, comment="소속/부서명")
    name = Column(String(100), nullable=False, index=True, comment="전공/팀/담당업무")
    phone = Column(String(100), nullable=False, index=True, comment="전화번호")
    location = Column(String(100), nullable=True, comment="위치 (학과용)")
    fax = Column(String(50), nullable=True, comment="팩스번호 (행정용)")
    created_at = Column(DateTime, server_default=func.now(), comment="생성일시")

    __table_args__ = (
        Index('ix_phone_dept_name', 'department', 'name'),
        Index('ix_phone_category', 'category'),
    )
