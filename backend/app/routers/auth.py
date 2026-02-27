from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import verify_password, get_password_hash, create_access_token
from app.core.config import settings
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.user import UserCreate, UserLogin, UserResponse, Token

router = APIRouter(prefix="/auth", tags=["인증"])


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register(user_data: UserCreate, db: Session = Depends(get_db)):
    """회원가입"""
    # 중복 학번 체크
    existing_user = db.query(User).filter(User.student_id == user_data.student_id).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="이미 등록된 학번입니다"
        )

    # 사용자 생성
    hashed_password = get_password_hash(user_data.password)
    new_user = User(
        student_id=user_data.student_id,
        password=hashed_password,
        name=user_data.name,
        department=user_data.department,
        profile_image=user_data.profile_image
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return new_user


@router.post("/login", response_model=Token)
def login(login_data: UserLogin, db: Session = Depends(get_db)):
    """로그인"""
    user = db.query(User).filter(User.student_id == login_data.student_id).first()

    if not user or not verify_password(login_data.password, user.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="학번 또는 비밀번호가 올바르지 않습니다"
        )

    access_token = create_access_token(
        data={"sub": str(user.id)},
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )

    return {"access_token": access_token, "token_type": "bearer", "user_id": user.id}


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
