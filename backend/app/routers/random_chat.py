from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, desc

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.chat import RandomChatQueue, RandomChatRoom, RandomChatMessage
from app.schemas.chat import RandomChatStatus, RandomChatMessageCreate, RandomChatMessageResponse

router = APIRouter(prefix="/random-chat", tags=["랜덤채팅"])


@router.post("/start", response_model=RandomChatStatus)
def start_random_chat(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """랜덤 채팅 시작 (매칭 대기 또는 즉시 매칭)"""

    # 이미 활성화된 랜덤 채팅방이 있는지 확인
    existing_room = db.query(RandomChatRoom).filter(
        RandomChatRoom.is_active == 1,
        or_(
            RandomChatRoom.user1_id == current_user.id,
            RandomChatRoom.user2_id == current_user.id
        )
    ).first()

    if existing_room:
        return RandomChatStatus(
            status="matched",
            room_id=existing_room.id,
            partner_name="익명"
        )

    # 이미 대기열에 있는지 확인
    existing_queue = db.query(RandomChatQueue).filter(
        RandomChatQueue.user_id == current_user.id
    ).first()

    if existing_queue:
        return RandomChatStatus(status="waiting")

    # 대기열에서 다른 사용자 찾기
    waiting_user = db.query(RandomChatQueue).filter(
        RandomChatQueue.user_id != current_user.id
    ).order_by(RandomChatQueue.created_at).first()

    if waiting_user:
        # 매칭 성공 - 채팅방 생성
        new_room = RandomChatRoom(
            user1_id=waiting_user.user_id,
            user2_id=current_user.id,
            is_active=1
        )
        db.add(new_room)

        # 대기열에서 제거
        db.delete(waiting_user)
        db.commit()
        db.refresh(new_room)

        return RandomChatStatus(
            status="matched",
            room_id=new_room.id,
            partner_name="익명"
        )
    else:
        # 대기열에 추가
        new_queue = RandomChatQueue(user_id=current_user.id)
        db.add(new_queue)
        db.commit()

        return RandomChatStatus(status="waiting")


@router.get("/status", response_model=RandomChatStatus)
def get_random_chat_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """현재 랜덤 채팅 상태 확인"""

    # 활성화된 채팅방 확인
    existing_room = db.query(RandomChatRoom).filter(
        RandomChatRoom.is_active == 1,
        or_(
            RandomChatRoom.user1_id == current_user.id,
            RandomChatRoom.user2_id == current_user.id
        )
    ).first()

    if existing_room:
        return RandomChatStatus(
            status="matched",
            room_id=existing_room.id,
            partner_name="익명"
        )

    # 대기열 확인
    in_queue = db.query(RandomChatQueue).filter(
        RandomChatQueue.user_id == current_user.id
    ).first()

    if in_queue:
        # 매칭된 상대가 있는지 다시 확인 (다른 사용자가 매칭했을 수 있음)
        matched_room = db.query(RandomChatRoom).filter(
            RandomChatRoom.is_active == 1,
            or_(
                RandomChatRoom.user1_id == current_user.id,
                RandomChatRoom.user2_id == current_user.id
            )
        ).first()

        if matched_room:
            # 대기열에서 제거
            db.delete(in_queue)
            db.commit()
            return RandomChatStatus(
                status="matched",
                room_id=matched_room.id,
                partner_name="익명"
            )

        return RandomChatStatus(status="waiting")

    return RandomChatStatus(status="none")


@router.post("/cancel")
def cancel_random_chat(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """대기열에서 나가기"""
    queue_entry = db.query(RandomChatQueue).filter(
        RandomChatQueue.user_id == current_user.id
    ).first()

    if queue_entry:
        db.delete(queue_entry)
        db.commit()

    return {"message": "대기가 취소되었습니다"}


@router.post("/disconnect")
def disconnect_random_chat(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """랜덤 채팅 연결 끊기"""
    room = db.query(RandomChatRoom).filter(
        RandomChatRoom.is_active == 1,
        or_(
            RandomChatRoom.user1_id == current_user.id,
            RandomChatRoom.user2_id == current_user.id
        )
    ).first()

    if room:
        room.is_active = 0
        db.commit()

    return {"message": "연결이 끊어졌습니다"}


@router.get("/messages/{room_id}", response_model=List[RandomChatMessageResponse])
def get_random_chat_messages(
    room_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """랜덤 채팅 메시지 조회"""
    room = db.query(RandomChatRoom).filter(
        RandomChatRoom.id == room_id,
        or_(
            RandomChatRoom.user1_id == current_user.id,
            RandomChatRoom.user2_id == current_user.id
        )
    ).first()

    if not room:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="채팅방을 찾을 수 없습니다"
        )

    messages = db.query(RandomChatMessage).filter(
        RandomChatMessage.room_id == room_id
    ).order_by(RandomChatMessage.created_at).all()

    result = []
    for msg in messages:
        result.append(RandomChatMessageResponse(
            id=msg.id,
            room_id=msg.room_id,
            message=msg.message,
            sender="나" if msg.user_id == current_user.id else "익명",
            is_mine=msg.user_id == current_user.id,
            created_at=msg.created_at
        ))

    return result


@router.post("/messages", response_model=RandomChatMessageResponse)
def send_random_chat_message(
    message_data: RandomChatMessageCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """랜덤 채팅 메시지 전송"""
    room = db.query(RandomChatRoom).filter(
        RandomChatRoom.id == message_data.room_id,
        RandomChatRoom.is_active == 1,
        or_(
            RandomChatRoom.user1_id == current_user.id,
            RandomChatRoom.user2_id == current_user.id
        )
    ).first()

    if not room:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="활성화된 채팅방을 찾을 수 없습니다"
        )

    new_message = RandomChatMessage(
        room_id=message_data.room_id,
        user_id=current_user.id,
        message=message_data.message
    )

    db.add(new_message)
    db.commit()
    db.refresh(new_message)

    return RandomChatMessageResponse(
        id=new_message.id,
        room_id=new_message.room_id,
        message=new_message.message,
        sender="나",
        is_mine=True,
        created_at=new_message.created_at
    )


@router.get("/room-status/{room_id}")
def get_room_status(
    room_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """채팅방 활성 상태 확인 (상대방이 나갔는지)"""
    room = db.query(RandomChatRoom).filter(
        RandomChatRoom.id == room_id,
        or_(
            RandomChatRoom.user1_id == current_user.id,
            RandomChatRoom.user2_id == current_user.id
        )
    ).first()

    if not room:
        return {"is_active": False}

    return {"is_active": room.is_active == 1}
