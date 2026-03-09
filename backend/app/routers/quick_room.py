from typing import List
from datetime import datetime, date

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func as sql_func

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.quick_room import QuickRoom, QuickRoomMember, QuickRoomChat
from app.schemas.quick_room import (
    QuickRoomCreate, QuickRoomResponse, QuickRoomMemberInfo,
    QuickRoomChatMessage, QuickRoomChatSend
)

router = APIRouter(prefix="/quick-room", tags=["급하게매칭"])


def build_room_response(db: Session, room: QuickRoom, current_user_id: int) -> QuickRoomResponse:
    """방 응답 객체 생성"""
    members = db.query(QuickRoomMember, User).join(
        User, QuickRoomMember.user_id == User.id
    ).filter(
        QuickRoomMember.room_id == room.id
    ).all()

    member_list = [
        QuickRoomMemberInfo(
            user_id=member.user_id,
            name=user.name,
            department=user.department,
            is_confirmed=member.is_confirmed or 0,
        )
        for member, user in members
    ]

    is_joined = any(m.user_id == current_user_id for m, _ in members)

    return QuickRoomResponse(
        id=room.id,
        creator_id=room.creator_id,
        title=room.title,
        departure=room.departure,
        destination=room.destination,
        depart_time=room.depart_time,
        max_members=room.max_members,
        is_active=room.is_active,
        current_members=len(member_list),
        members=member_list,
        is_joined=is_joined,
        created_at=room.created_at,
    )


@router.get("/rooms", response_model=List[QuickRoomResponse])
def get_rooms(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """오늘의 급하게 매칭 방 목록"""
    today = date.today()
    rooms = db.query(QuickRoom).filter(
        QuickRoom.is_active == 1,
        sql_func.date(QuickRoom.created_at) == today
    ).order_by(QuickRoom.created_at.desc()).all()

    return [build_room_response(db, room, current_user.id) for room in rooms]


@router.post("/rooms", response_model=QuickRoomResponse)
def create_room(
    data: QuickRoomCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """방 생성"""
    if not data.title.strip():
        raise HTTPException(status_code=400, detail="방 제목을 입력하세요")
    if not data.departure.strip():
        raise HTTPException(status_code=400, detail="출발지를 입력하세요")
    if not data.destination.strip():
        raise HTTPException(status_code=400, detail="도착지를 입력하세요")

    room = QuickRoom(
        creator_id=current_user.id,
        title=data.title.strip(),
        departure=data.departure.strip(),
        destination=data.destination.strip(),
        depart_time=data.depart_time,
        max_members=4,
    )
    db.add(room)
    db.commit()
    db.refresh(room)

    # 방장 자동 참여
    member = QuickRoomMember(room_id=room.id, user_id=current_user.id)
    db.add(member)
    db.commit()

    return build_room_response(db, room, current_user.id)


@router.post("/rooms/{room_id}/join")
def join_room(
    room_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """방 참여"""
    room = db.query(QuickRoom).filter(QuickRoom.id == room_id, QuickRoom.is_active == 1).first()
    if not room:
        raise HTTPException(status_code=404, detail="방을 찾을 수 없습니다")

    # 이미 참여 중인지 확인
    existing = db.query(QuickRoomMember).filter(
        QuickRoomMember.room_id == room_id,
        QuickRoomMember.user_id == current_user.id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="이미 참여 중입니다")

    # 인원 확인
    member_count = db.query(QuickRoomMember).filter(QuickRoomMember.room_id == room_id).count()
    if member_count >= room.max_members:
        raise HTTPException(status_code=400, detail="방이 가득 찼습니다")

    member = QuickRoomMember(room_id=room_id, user_id=current_user.id)
    db.add(member)

    # 시스템 메시지 추가 (입장 알림)
    system_msg = QuickRoomChat(
        room_id=room_id,
        user_id=current_user.id,
        message=f"{current_user.name}님이 입장했습니다 🎉",
        is_system=1,
    )
    db.add(system_msg)
    db.commit()

    return {"message": "참여 완료"}


@router.post("/rooms/{room_id}/leave")
def leave_room(
    room_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """방 나가기"""
    member = db.query(QuickRoomMember).filter(
        QuickRoomMember.room_id == room_id,
        QuickRoomMember.user_id == current_user.id
    ).first()
    if not member:
        raise HTTPException(status_code=400, detail="참여 중이 아닙니다")

    db.delete(member)

    # 시스템 메시지 추가 (퇴장 알림)
    system_msg = QuickRoomChat(
        room_id=room_id,
        user_id=current_user.id,
        message=f"{current_user.name}님이 나갔습니다",
        is_system=1,
    )
    db.add(system_msg)

    # 남은 멤버가 없으면 방 비활성화
    remaining = db.query(QuickRoomMember).filter(QuickRoomMember.room_id == room_id).count()
    if remaining <= 1:  # 삭제 전 카운트이므로 1 이하면 0명
        room = db.query(QuickRoom).filter(QuickRoom.id == room_id).first()
        if room:
            room.is_active = 0

    db.commit()
    return {"message": "나가기 완료"}


@router.delete("/rooms/{room_id}")
def close_room(
    room_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """방 마감 (방장만)"""
    room = db.query(QuickRoom).filter(QuickRoom.id == room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="방을 찾을 수 없습니다")
    if room.creator_id != current_user.id:
        raise HTTPException(status_code=403, detail="방장만 마감할 수 있습니다")

    room.is_active = 0
    db.commit()
    return {"message": "방이 마감되었습니다"}


@router.get("/rooms/{room_id}", response_model=QuickRoomResponse)
def get_room_detail(
    room_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """방 상세 조회"""
    room = db.query(QuickRoom).filter(QuickRoom.id == room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="방을 찾을 수 없습니다")

    return build_room_response(db, room, current_user.id)


@router.get("/rooms/{room_id}/messages", response_model=List[QuickRoomChatMessage])
def get_room_messages(
    room_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """방 채팅 메시지 조회"""
    is_member = db.query(QuickRoomMember).filter(
        QuickRoomMember.room_id == room_id,
        QuickRoomMember.user_id == current_user.id
    ).first()
    if not is_member:
        raise HTTPException(status_code=403, detail="이 방의 멤버가 아닙니다")

    messages = db.query(QuickRoomChat, User).join(
        User, QuickRoomChat.user_id == User.id
    ).filter(
        QuickRoomChat.room_id == room_id
    ).order_by(QuickRoomChat.created_at).all()

    return [
        QuickRoomChatMessage(
            id=msg.id,
            room_id=msg.room_id,
            user_id=msg.user_id,
            sender=user.name,
            message=msg.message,
            is_mine=msg.user_id == current_user.id,
            is_system=msg.is_system or 0,
            created_at=msg.created_at,
        )
        for msg, user in messages
    ]


@router.post("/rooms/messages", response_model=QuickRoomChatMessage)
def send_room_message(
    data: QuickRoomChatSend,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """방 채팅 메시지 전송"""
    is_member = db.query(QuickRoomMember).filter(
        QuickRoomMember.room_id == data.room_id,
        QuickRoomMember.user_id == current_user.id
    ).first()
    if not is_member:
        raise HTTPException(status_code=403, detail="이 방의 멤버가 아닙니다")

    new_msg = QuickRoomChat(
        room_id=data.room_id,
        user_id=current_user.id,
        message=data.message,
    )
    db.add(new_msg)
    db.commit()
    db.refresh(new_msg)

    return QuickRoomChatMessage(
        id=new_msg.id,
        room_id=new_msg.room_id,
        user_id=new_msg.user_id,
        sender=current_user.name,
        message=new_msg.message,
        is_mine=True,
        is_system=0,
        created_at=new_msg.created_at,
    )


@router.post("/rooms/{room_id}/confirm")
def confirm_attendance(
    room_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """출석 확인 (꼭 갈거에요!)"""
    member = db.query(QuickRoomMember).filter(
        QuickRoomMember.room_id == room_id,
        QuickRoomMember.user_id == current_user.id
    ).first()

    if not member:
        raise HTTPException(status_code=403, detail="이 방의 멤버가 아닙니다")

    member.is_confirmed = 1
    db.commit()

    return {"message": "출석 확인 완료", "is_confirmed": 1}


@router.delete("/rooms/{room_id}/confirm")
def cancel_attendance(
    room_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """출석 확인 취소"""
    member = db.query(QuickRoomMember).filter(
        QuickRoomMember.room_id == room_id,
        QuickRoomMember.user_id == current_user.id
    ).first()

    if not member:
        raise HTTPException(status_code=403, detail="이 방의 멤버가 아닙니다")

    member.is_confirmed = 0
    db.commit()

    return {"message": "출석 확인 취소", "is_confirmed": 0}
