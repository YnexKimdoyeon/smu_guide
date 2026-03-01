"""
동아리 홍보 모델
"""
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class Club(Base):
    """동아리 게시글"""
    __tablename__ = "SMU_CLUBS"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("SMU_USERS.id"), nullable=False)
    name = Column(String(100), nullable=False)  # 동아리 이름
    description = Column(Text, nullable=False)  # 동아리 설명
    qna_questions = Column(JSON, nullable=True)  # QNA 질문 목록 ["질문1", "질문2", ...]
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # 관계
    user = relationship("User", backref="clubs")
    applications = relationship("ClubApplication", back_populates="club", cascade="all, delete-orphan")


class ClubApplication(Base):
    """동아리 신청"""
    __tablename__ = "SMU_CLUB_APPLICATIONS"

    id = Column(Integer, primary_key=True, index=True)
    club_id = Column(Integer, ForeignKey("SMU_CLUBS.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("SMU_USERS.id"), nullable=False)
    name = Column(String(50), nullable=False)  # 신청자 이름
    student_id = Column(String(20), nullable=False)  # 신청자 학번
    qna_answers = Column(JSON, nullable=True)  # QNA 답변 {"질문1": "답변1", ...}
    created_at = Column(DateTime, server_default=func.now())

    # 관계
    club = relationship("Club", back_populates="applications")
    user = relationship("User", backref="club_applications")
