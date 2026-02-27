from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import desc, func, distinct

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.chat import ChatRoom, ChatRoomMember, ChatMessage
from app.models.schedule import Schedule
from app.schemas.chat import ChatRoomCreate, ChatRoomResponse, ChatMessageCreate, ChatMessageResponse

router = APIRouter(prefix="/chat", tags=["채팅"])

GLOBAL_ROOM_NAME = "전체 채팅"


def get_or_create_global_room(db: Session) -> ChatRoom:
    """전체 채팅방 조회 또는 생성"""
    room = db.query(ChatRoom).filter(
        ChatRoom.room_type == "global"
    ).first()

    if not room:
        room = ChatRoom(
            name=GLOBAL_ROOM_NAME,
            description="선문대학교 전체 익명 채팅방",
            room_type="global",
            subject_key=None,
            created_by=None
        )
        db.add(room)
        db.commit()
        db.refresh(room)

    return room


def generate_subject_key(schedule: Schedule) -> str:
    """시간표에서 과목 키 생성 (과목명|교수명)"""
    professor = schedule.professor or ''
    return f"{schedule.subject}|{professor}"


def get_or_create_subject_room(db: Session, schedule: Schedule, all_schedules: list = None) -> ChatRoom:
    """과목 채팅방 조회 또는 생성"""
    subject_key = generate_subject_key(schedule)

    room = db.query(ChatRoom).filter(
        ChatRoom.room_type == "subject",
        ChatRoom.subject_key == subject_key
    ).first()

    # 같은 과목의 모든 요일/시간 수집
    if all_schedules:
        same_subject = [s for s in all_schedules if generate_subject_key(s) == subject_key]
        times = [f"{s.day} {s.start_time}~{s.end_time}" for s in same_subject]
        unique_times = list(dict.fromkeys(times))  # 중복 제거, 순서 유지
        description = f"{', '.join(unique_times)} | {schedule.professor or ''}"
    else:
        description = f"{schedule.day} {schedule.start_time}~{schedule.end_time} | {schedule.professor or ''}"

    if not room:
        room = ChatRoom(
            name=f"{schedule.subject}",
            description=description,
            room_type="subject",
            subject_key=subject_key,
            created_by=None
        )
        db.add(room)
        db.commit()
        db.refresh(room)
    else:
        # 기존 방의 description 업데이트
        if room.description != description:
            room.description = description
            db.commit()

    return room


def get_user_subject_keys(db: Session, user_id: int) -> List[str]:
    """사용자의 모든 과목 키 목록 조회"""
    schedules = db.query(Schedule).filter(Schedule.user_id == user_id).all()
    return [generate_subject_key(s) for s in schedules]


def can_access_room(db: Session, user_id: int, room: ChatRoom) -> bool:
    """사용자가 채팅방에 접근 가능한지 확인"""
    if room.room_type == "global":
        return True

    if room.room_type == "subject":
        user_keys = get_user_subject_keys(db, user_id)
        return room.subject_key in user_keys

    return False


@router.get("/rooms", response_model=List[ChatRoomResponse])
def get_chat_rooms(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """내가 접근 가능한 채팅방 목록 조회"""
    # 내 시간표 조회
    my_schedules = db.query(Schedule).filter(Schedule.user_id == current_user.id).all()
    my_subject_keys = list(set(generate_subject_key(s) for s in my_schedules))

    # 전체 채팅방
    global_room = get_or_create_global_room(db)

    # 과목 채팅방 조회/생성
    subject_rooms = []
    if my_subject_keys:
        existing_rooms = db.query(ChatRoom).filter(
            ChatRoom.room_type == "subject",
            ChatRoom.subject_key.in_(my_subject_keys)
        ).all()
        existing_keys = {r.subject_key: r for r in existing_rooms}

        # 없는 방만 생성
        created_keys = set()
        for schedule in my_schedules:
            key = generate_subject_key(schedule)
            if key not in existing_keys and key not in created_keys:
                same_subject = [s for s in my_schedules if generate_subject_key(s) == key]
                times = list(dict.fromkeys([f"{s.day} {s.start_time}~{s.end_time}" for s in same_subject]))
                description = f"{', '.join(times)} | {schedule.professor or ''}"

                new_room = ChatRoom(
                    name=schedule.subject,
                    description=description,
                    room_type="subject",
                    subject_key=key,
                    created_by=None
                )
                db.add(new_room)
                created_keys.add(key)
                subject_rooms.append(new_room)

        if created_keys:
            db.commit()

        subject_rooms = list(existing_rooms) + subject_rooms

    all_rooms = [global_room] + subject_rooms

    # 과목별 수강생 수 계산
    subject_participant_counts = {}
    if my_subject_keys:
        # 각 과목 키에 해당하는 사용자 수 조회
        all_schedules = db.query(Schedule).all()
        for schedule in all_schedules:
            key = generate_subject_key(schedule)
            if key not in subject_participant_counts:
                subject_participant_counts[key] = set()
            subject_participant_counts[key].add(schedule.user_id)

    # 결과 구성
    result = []
    for room in all_rooms:
        if room.room_type == "global":
            # 전체 채팅방은 전체 사용자 수
            participant_count = db.query(User).count()
        else:
            # 과목 채팅방은 해당 과목 수강생 수
            participant_count = len(subject_participant_counts.get(room.subject_key, set()))

        result.append({
            "id": room.id,
            "name": room.name,
            "description": room.description,
            "room_type": room.room_type,
            "subject_key": room.subject_key,
            "created_by": room.created_by,
            "created_at": room.created_at.isoformat() if room.created_at else None,
            "participants": participant_count,
            "last_message": None,
            "last_time": None
        })

    return result


@router.post("/rooms/{room_id}/join", status_code=status.HTTP_200_OK)
def join_chat_room(
    room_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """채팅방 참여"""
    room = db.query(ChatRoom).filter(ChatRoom.id == room_id).first()
    if not room:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="채팅방을 찾을 수 없습니다"
        )

    # 접근 권한 확인
    if not can_access_room(db, current_user.id, room):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="이 채팅방에 접근할 수 없습니다"
        )

    # 이미 참여 중인지 확인
    existing = db.query(ChatRoomMember).filter(
        ChatRoomMember.room_id == room_id,
        ChatRoomMember.user_id == current_user.id
    ).first()

    if existing:
        return {"message": "이미 참여 중입니다"}

    member = ChatRoomMember(room_id=room_id, user_id=current_user.id)
    db.add(member)
    db.commit()

    return {"message": "채팅방에 참여했습니다"}


@router.get("/rooms/{room_id}/messages", response_model=List[ChatMessageResponse])
def get_chat_messages(
    room_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """채팅 메시지 조회"""
    room = db.query(ChatRoom).filter(ChatRoom.id == room_id).first()
    if not room:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="채팅방을 찾을 수 없습니다"
        )

    # 접근 권한 확인
    if not can_access_room(db, current_user.id, room):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="이 채팅방에 접근할 수 없습니다"
        )

    messages = db.query(ChatMessage).filter(
        ChatMessage.room_id == room_id
    ).order_by(ChatMessage.created_at).all()

    result = []
    for msg in messages:
        # 익명 번호 생성 (user_id 해시)
        anon_num = (msg.user_id * 7) % 1000
        result.append(ChatMessageResponse(
            id=msg.id,
            room_id=msg.room_id,
            user_id=msg.user_id,
            message=msg.message,
            sender=f"익명{anon_num}" if msg.user_id != current_user.id else "나",
            is_mine=msg.user_id == current_user.id,
            created_at=msg.created_at
        ))

    return result


@router.post("/messages", response_model=ChatMessageResponse, status_code=status.HTTP_201_CREATED)
def send_message(
    message_data: ChatMessageCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """메시지 전송"""
    room = db.query(ChatRoom).filter(ChatRoom.id == message_data.room_id).first()
    if not room:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="채팅방을 찾을 수 없습니다"
        )

    # 접근 권한 확인
    if not can_access_room(db, current_user.id, room):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="이 채팅방에 메시지를 보낼 수 없습니다"
        )

    new_message = ChatMessage(
        room_id=message_data.room_id,
        user_id=current_user.id,
        message=message_data.message
    )

    db.add(new_message)
    db.commit()
    db.refresh(new_message)

    return ChatMessageResponse(
        id=new_message.id,
        room_id=new_message.room_id,
        user_id=new_message.user_id,
        message=new_message.message,
        sender="나",
        is_mine=True,
        created_at=new_message.created_at
    )
