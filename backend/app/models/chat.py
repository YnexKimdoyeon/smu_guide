from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Text, Index
from sqlalchemy.sql import func

from app.core.database import Base


class ChatRoom(Base):
    __tablename__ = "SMU_CHAT_ROOMS"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(100), nullable=False, comment="채팅방 이름")
    description = Column(String(500), nullable=True, comment="채팅방 설명")
    room_type = Column(String(20), nullable=False, default="subject", index=True, comment="채팅방 유형: global, subject")
    subject_key = Column(String(200), nullable=True, index=True, comment="과목 키: subject|professor")
    created_by = Column(Integer, ForeignKey("SMU_USERS.id"), nullable=True, comment="생성자 ID")
    created_at = Column(DateTime, server_default=func.now(), comment="생성일시")


class ChatRoomMember(Base):
    __tablename__ = "SMU_CHAT_ROOM_MEMBERS"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    room_id = Column(Integer, ForeignKey("SMU_CHAT_ROOMS.id"), nullable=False, index=True, comment="채팅방 ID")
    user_id = Column(Integer, ForeignKey("SMU_USERS.id"), nullable=False, index=True, comment="사용자 ID")
    joined_at = Column(DateTime, server_default=func.now(), comment="참여일시")

    __table_args__ = (
        Index('idx_member_room_user', 'room_id', 'user_id'),
    )


class ChatMessage(Base):
    __tablename__ = "SMU_CHAT_MESSAGES"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    room_id = Column(Integer, ForeignKey("SMU_CHAT_ROOMS.id"), nullable=False, index=True, comment="채팅방 ID")
    user_id = Column(Integer, ForeignKey("SMU_USERS.id"), nullable=False, comment="발신자 ID")
    message = Column(Text, nullable=False, comment="메시지 내용")
    created_at = Column(DateTime, server_default=func.now(), index=True, comment="발신일시")

    __table_args__ = (
        Index('idx_message_room_created', 'room_id', 'created_at'),
    )


class RandomChatQueue(Base):
    __tablename__ = "SMU_RANDOM_CHAT_QUEUE"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("SMU_USERS.id"), nullable=False, unique=True, comment="대기 중인 사용자 ID")
    created_at = Column(DateTime, server_default=func.now(), comment="대기 시작 시간")


class RandomChatRoom(Base):
    __tablename__ = "SMU_RANDOM_CHAT_ROOMS"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user1_id = Column(Integer, ForeignKey("SMU_USERS.id"), nullable=False, comment="사용자1 ID")
    user2_id = Column(Integer, ForeignKey("SMU_USERS.id"), nullable=False, comment="사용자2 ID")
    is_active = Column(Integer, default=1, comment="활성화 여부")
    created_at = Column(DateTime, server_default=func.now(), comment="매칭 시간")


class RandomChatMessage(Base):
    __tablename__ = "SMU_RANDOM_CHAT_MESSAGES"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    room_id = Column(Integer, ForeignKey("SMU_RANDOM_CHAT_ROOMS.id"), nullable=False, comment="랜덤채팅방 ID")
    user_id = Column(Integer, ForeignKey("SMU_USERS.id"), nullable=False, comment="발신자 ID")
    message = Column(Text, nullable=False, comment="메시지 내용")
    created_at = Column(DateTime, server_default=func.now(), comment="발신일시")
