"""
WebSocket 채팅 라우터
"""
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, Query
from sqlalchemy.orm import Session
from jose import jwt, JWTError

from app.core.database import SessionLocal
from app.core.config import settings
from app.core.websocket import manager
from app.models.user import User
from app.models.chat import ChatRoom, ChatMessage, RandomChatQueue, RandomChatRoom, RandomChatMessage
from app.models.schedule import Schedule

router = APIRouter()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def verify_token(token: str) -> int:
    """토큰 검증 및 user_id 반환"""
    try:
        payload = jwt.decode(token, settings.get_secret_key(), algorithms=[settings.ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            return None
        return int(user_id)
    except JWTError:
        return None


def generate_subject_key(schedule: Schedule) -> str:
    """시간표에서 과목 키 생성"""
    professor = schedule.professor or ''
    return f"{schedule.subject}|{professor}"


def can_access_room(db: Session, user_id: int, room: ChatRoom) -> bool:
    """사용자가 채팅방에 접근 가능한지 확인"""
    if room.room_type == "global":
        return True

    if room.room_type == "subject":
        schedules = db.query(Schedule).filter(Schedule.user_id == user_id).all()
        user_keys = [generate_subject_key(s) for s in schedules]
        return room.subject_key in user_keys

    return False


@router.websocket("/ws/chat/{room_id}")
async def websocket_chat(
    websocket: WebSocket,
    room_id: int,
    token: str = Query(...)
):
    """채팅방 WebSocket 연결"""
    # 토큰 검증
    user_id = verify_token(token)
    if not user_id:
        await websocket.close(code=4001)
        return

    # 채팅방 확인 (짧은 세션)
    db = SessionLocal()
    try:
        room = db.query(ChatRoom).filter(ChatRoom.id == room_id).first()
        if not room:
            await websocket.close(code=4004)
            return

        if not can_access_room(db, user_id, room):
            await websocket.close(code=4003)
            return
    finally:
        db.close()

    # 연결
    conn_id = await manager.connect(websocket, room_id, user_id)

    # 접속 알림
    await manager.broadcast_to_room(room_id, {
        "type": "system",
        "message": "새로운 사용자가 입장했습니다",
        "online_count": manager.get_room_user_count(room_id)
    })

    try:
        while True:
            # 메시지 수신
            data = await websocket.receive_json()

            if data.get("type") == "message":
                message_text = data.get("message", "").strip()
                if not message_text:
                    continue

                # DB에 메시지 저장 (새 세션)
                db = SessionLocal()
                try:
                    new_message = ChatMessage(
                        room_id=room_id,
                        user_id=user_id,
                        message=message_text
                    )
                    db.add(new_message)
                    db.commit()
                    db.refresh(new_message)
                    msg_id = new_message.id
                    msg_time = new_message.created_at.isoformat()
                finally:
                    db.close()

                # 익명 번호 생성
                anon_num = (user_id * 7) % 1000

                # 전체에 브로드캐스트
                await manager.broadcast_to_room(room_id, {
                    "type": "message",
                    "id": msg_id,
                    "sender": f"익명{anon_num}",
                    "message": message_text,
                    "created_at": msg_time,
                    "user_id": user_id
                })

    except WebSocketDisconnect:
        manager.disconnect(room_id, conn_id)
        await manager.broadcast_to_room(room_id, {
            "type": "system",
            "message": "사용자가 퇴장했습니다",
            "online_count": manager.get_room_user_count(room_id)
        })


@router.websocket("/ws/random")
async def websocket_random_chat(
    websocket: WebSocket,
    token: str = Query(...)
):
    """랜덤 채팅 WebSocket 연결"""
    user_id = verify_token(token)
    if not user_id:
        await websocket.close(code=4001)
        return

    await manager.connect_random(websocket, user_id)

    room_id = None
    partner_user_id = None

    # 초기 처리 (짧은 세션)
    db = SessionLocal()
    try:
        # 대기열에 추가
        existing_queue = db.query(RandomChatQueue).filter(
            RandomChatQueue.user_id == user_id
        ).first()

        if not existing_queue:
            queue_entry = RandomChatQueue(user_id=user_id)
            db.add(queue_entry)
            db.commit()

        # 매칭 시도 - 실제 연결된 유저만
        partners = db.query(RandomChatQueue).filter(
            RandomChatQueue.user_id != user_id
        ).all()

        # 실제로 WebSocket 연결된 상대 찾기
        connected_partner = None
        for p in partners:
            if p.user_id in manager.random_connections:
                connected_partner = p
                break
            else:
                # 연결 안된 유저는 대기열에서 제거
                db.delete(p)

        if connected_partner:
            # 매칭 성공 - 상대방 ID 먼저 저장
            partner_user_id = connected_partner.user_id

            # 방 생성
            new_room = RandomChatRoom(
                user1_id=user_id,
                user2_id=partner_user_id,
                is_active=True
            )
            db.add(new_room)

            # 대기열에서 제거
            db.query(RandomChatQueue).filter(
                RandomChatQueue.user_id.in_([user_id, partner_user_id])
            ).delete(synchronize_session=False)

            db.commit()
            db.refresh(new_room)
            room_id = new_room.id
        else:
            db.commit()  # 정리된 대기열 저장
    finally:
        db.close()

    # 매칭 결과 알림
    if room_id:
        await manager.send_personal(websocket, {
            "type": "matched",
            "room_id": room_id
        })

        if partner_user_id in manager.random_connections:
            await manager.send_to_user(partner_user_id, {
                "type": "matched",
                "room_id": room_id
            })
    else:
        await manager.send_personal(websocket, {
            "type": "waiting"
        })

    try:
        while True:
            data = await websocket.receive_json()

            if data.get("type") == "message":
                message_text = data.get("message", "").strip()
                if not message_text:
                    continue

                # room_id가 없으면 DB에서 매칭된 방 확인
                if not room_id:
                    db = SessionLocal()
                    try:
                        matched_room = db.query(RandomChatRoom).filter(
                            RandomChatRoom.is_active == True,
                            ((RandomChatRoom.user1_id == user_id) | (RandomChatRoom.user2_id == user_id))
                        ).first()
                        if matched_room:
                            room_id = matched_room.id
                    finally:
                        db.close()

                if not room_id:
                    # 아직 매칭 안됨
                    await manager.send_personal(websocket, {
                        "type": "error",
                        "message": "아직 매칭되지 않았습니다"
                    })
                    continue

                # 메시지 저장 (새 세션)
                db = SessionLocal()
                try:
                    new_msg = RandomChatMessage(
                        room_id=room_id,
                        user_id=user_id,
                        message=message_text
                    )
                    db.add(new_msg)
                    db.commit()
                    db.refresh(new_msg)
                    msg_id = new_msg.id
                    msg_time = new_msg.created_at.isoformat()

                    # 상대방 찾기
                    room = db.query(RandomChatRoom).filter(
                        RandomChatRoom.id == room_id
                    ).first()
                    partner_id = room.user2_id if room.user1_id == user_id else room.user1_id
                finally:
                    db.close()

                # 상대방에게 전송
                await manager.send_to_user(partner_id, {
                    "type": "message",
                    "id": msg_id,
                    "user_id": user_id,
                    "sender": "상대방",
                    "message": message_text,
                    "created_at": msg_time,
                    "is_mine": False
                })

                # 본인에게도 전송 (확인용)
                await manager.send_personal(websocket, {
                    "type": "message",
                    "id": msg_id,
                    "user_id": user_id,
                    "sender": "나",
                    "message": message_text,
                    "created_at": msg_time,
                    "is_mine": True
                })

            elif data.get("type") == "disconnect":
                if room_id:
                    # 방 비활성화 (새 세션)
                    db = SessionLocal()
                    try:
                        room = db.query(RandomChatRoom).filter(
                            RandomChatRoom.id == room_id
                        ).first()
                        if room:
                            room.is_active = False
                            partner_id = room.user2_id if room.user1_id == user_id else room.user1_id
                            db.commit()
                    finally:
                        db.close()

                    # 상대방에게 알림
                    await manager.send_to_user(partner_id, {
                        "type": "partner_left"
                    })
                break

    except WebSocketDisconnect:
        # 연결 끊김 처리 - 세션 완전 종료
        manager.disconnect_random(user_id)

        db = SessionLocal()
        try:
            # 대기열에서 제거
            db.query(RandomChatQueue).filter(
                RandomChatQueue.user_id == user_id
            ).delete()

            # 활성 방이 있으면 비활성화하고 상대방에게 알림
            if room_id:
                room = db.query(RandomChatRoom).filter(
                    RandomChatRoom.id == room_id
                ).first()
                if room and room.is_active:
                    room.is_active = False
                    partner_id = room.user2_id if room.user1_id == user_id else room.user1_id
                    db.commit()

                    # 상대방에게 알림
                    await manager.send_to_user(partner_id, {
                        "type": "partner_left"
                    })
            else:
                db.commit()
        finally:
            db.close()
