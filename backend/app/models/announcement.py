from sqlalchemy import Column, Integer, String, Text, DateTime
from sqlalchemy.sql import func

from app.core.database import Base


class Announcement(Base):
    __tablename__ = "SMU_ANNOUNCEMENTS"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    notice_no = Column(Integer, nullable=True, unique=True, comment="원본 공지 번호")
    title = Column(String(500), nullable=False, comment="제목")
    content = Column(Text, nullable=True, comment="내용")
    category = Column(String(50), nullable=False, default="일반", comment="카테고리 (학사/일반/장학/취업)")
    writer = Column(String(100), nullable=True, comment="작성자")
    notice_date = Column(String(20), nullable=True, comment="공지 날짜")
    views = Column(Integer, default=0, comment="조회수")
    external_url = Column(String(500), nullable=True, comment="외부 링크")
    is_new = Column(Integer, default=1, comment="새 글 여부")
    created_at = Column(DateTime, server_default=func.now(), comment="생성일시")
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), comment="수정일시")
