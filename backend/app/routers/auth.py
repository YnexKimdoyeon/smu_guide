from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.user import UserResponse

router = APIRouter(prefix="/auth", tags=["인증"])


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    """현재 로그인한 사용자 정보"""
    return current_user


@router.delete("/withdraw", status_code=status.HTTP_200_OK)
def withdraw(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """회원탈퇴 - 사용자와 관련된 모든 데이터 삭제"""
    from app.models.schedule import Schedule
    from app.models.friend import Friend
    from app.models.chat import ChatRoomMember, ChatMessage, RandomChatQueue, RandomChatRoom, RandomChatMessage
    from app.models.commute import CommuteSchedule, CommuteGroupMember, CommuteChat

    user_id = current_user.id

    # 1. 랜덤 채팅 관련 삭제
    # 랜덤 채팅 메시지 삭제
    random_rooms = db.query(RandomChatRoom).filter(
        (RandomChatRoom.user1_id == user_id) | (RandomChatRoom.user2_id == user_id)
    ).all()
    for room in random_rooms:
        db.query(RandomChatMessage).filter(RandomChatMessage.room_id == room.id).delete()

    # 랜덤 채팅방 삭제
    db.query(RandomChatRoom).filter(
        (RandomChatRoom.user1_id == user_id) | (RandomChatRoom.user2_id == user_id)
    ).delete(synchronize_session=False)

    # 랜덤 채팅 대기열 삭제
    db.query(RandomChatQueue).filter(RandomChatQueue.user_id == user_id).delete()

    # 2. 일반 채팅 관련 삭제
    db.query(ChatMessage).filter(ChatMessage.user_id == user_id).delete()
    db.query(ChatRoomMember).filter(ChatRoomMember.user_id == user_id).delete()

    # 3. 등하교 관련 삭제
    db.query(CommuteChat).filter(CommuteChat.user_id == user_id).delete()
    db.query(CommuteGroupMember).filter(CommuteGroupMember.user_id == user_id).delete()
    db.query(CommuteSchedule).filter(CommuteSchedule.user_id == user_id).delete()

    # 4. 친구 관계 삭제
    db.query(Friend).filter(
        (Friend.user_id == user_id) | (Friend.friend_id == user_id)
    ).delete(synchronize_session=False)

    # 5. 시간표 삭제
    db.query(Schedule).filter(Schedule.user_id == user_id).delete()

    # 6. 사용자 삭제
    db.query(User).filter(User.id == user_id).delete()

    db.commit()

    return {"message": "회원탈퇴가 완료되었습니다"}
