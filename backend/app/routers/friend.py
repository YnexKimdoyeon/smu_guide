from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.friend import Friend
from app.models.schedule import Schedule
from app.schemas.friend import FriendCreate, FriendUpdate, FriendResponse, FreeTimeSlot

router = APIRouter(prefix="/friends", tags=["친구"])


@router.get("", response_model=List[FriendResponse])
def get_friends(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """친구 목록 조회 (수락된 친구)"""
    friends = db.query(Friend, User).join(
        User, Friend.friend_id == User.id
    ).filter(
        Friend.user_id == current_user.id,
        Friend.status == "accepted"
    ).all()

    result = []
    for friend, user in friends:
        result.append(FriendResponse(
            id=friend.id,
            user_id=friend.user_id,
            friend_id=friend.friend_id,
            status=friend.status,
            created_at=friend.created_at,
            friend_name=user.name,
            friend_student_id=user.student_id,
            friend_department=user.department
        ))

    return result


@router.get("/requests", response_model=List[FriendResponse])
def get_friend_requests(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """받은 친구 요청 목록"""
    requests = db.query(Friend, User).join(
        User, Friend.user_id == User.id
    ).filter(
        Friend.friend_id == current_user.id,
        Friend.status == "pending"
    ).all()

    result = []
    for friend, user in requests:
        result.append(FriendResponse(
            id=friend.id,
            user_id=friend.user_id,
            friend_id=friend.friend_id,
            status=friend.status,
            created_at=friend.created_at,
            friend_name=user.name,
            friend_student_id=user.student_id,
            friend_department=user.department
        ))

    return result


@router.post("", response_model=FriendResponse, status_code=status.HTTP_201_CREATED)
def send_friend_request(
    friend_data: FriendCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """친구 요청 보내기"""
    if friend_data.friend_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="자기 자신에게 친구 요청을 보낼 수 없습니다"
        )

    # 대상 사용자 존재 확인
    target_user = db.query(User).filter(User.id == friend_data.friend_id).first()
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="사용자를 찾을 수 없습니다"
        )

    # 이미 친구 관계인지 확인
    existing = db.query(Friend).filter(
        or_(
            and_(Friend.user_id == current_user.id, Friend.friend_id == friend_data.friend_id),
            and_(Friend.user_id == friend_data.friend_id, Friend.friend_id == current_user.id)
        )
    ).first()

    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="이미 친구이거나 요청이 진행 중입니다"
        )

    new_friend = Friend(
        user_id=current_user.id,
        friend_id=friend_data.friend_id,
        status="pending"
    )

    db.add(new_friend)
    db.commit()
    db.refresh(new_friend)

    return FriendResponse(
        id=new_friend.id,
        user_id=new_friend.user_id,
        friend_id=new_friend.friend_id,
        status=new_friend.status,
        created_at=new_friend.created_at,
        friend_name=target_user.name,
        friend_student_id=target_user.student_id,
        friend_department=target_user.department
    )


@router.post("/request-by-student-id", response_model=FriendResponse, status_code=status.HTTP_201_CREATED)
def send_friend_request_by_student_id(
    student_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """학번으로 친구 요청 보내기"""
    # 대상 사용자 존재 확인
    target_user = db.query(User).filter(User.student_id == student_id).first()
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="해당 학번의 사용자를 찾을 수 없습니다"
        )

    if target_user.id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="자기 자신에게 친구 요청을 보낼 수 없습니다"
        )

    # 이미 친구 관계인지 확인
    existing = db.query(Friend).filter(
        or_(
            and_(Friend.user_id == current_user.id, Friend.friend_id == target_user.id),
            and_(Friend.user_id == target_user.id, Friend.friend_id == current_user.id)
        )
    ).first()

    if existing:
        if existing.status == "accepted":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="이미 친구입니다"
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="이미 친구 요청이 진행 중입니다"
            )

    new_friend = Friend(
        user_id=current_user.id,
        friend_id=target_user.id,
        status="pending"
    )

    db.add(new_friend)
    db.commit()
    db.refresh(new_friend)

    return FriendResponse(
        id=new_friend.id,
        user_id=new_friend.user_id,
        friend_id=new_friend.friend_id,
        status=new_friend.status,
        created_at=new_friend.created_at,
        friend_name=target_user.name,
        friend_student_id=target_user.student_id,
        friend_department=target_user.department
    )


@router.put("/{friend_id}/accept", response_model=FriendResponse)
def accept_friend_request(
    friend_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """친구 요청 수락"""
    friend_request = db.query(Friend).filter(
        Friend.id == friend_id,
        Friend.friend_id == current_user.id,
        Friend.status == "pending"
    ).first()

    if not friend_request:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="친구 요청을 찾을 수 없습니다"
        )

    friend_request.status = "accepted"

    # 양방향 친구 관계 생성
    reverse_friend = Friend(
        user_id=current_user.id,
        friend_id=friend_request.user_id,
        status="accepted"
    )
    db.add(reverse_friend)

    db.commit()
    db.refresh(friend_request)

    requester = db.query(User).filter(User.id == friend_request.user_id).first()

    return FriendResponse(
        id=friend_request.id,
        user_id=friend_request.user_id,
        friend_id=friend_request.friend_id,
        status=friend_request.status,
        created_at=friend_request.created_at,
        friend_name=requester.name,
        friend_student_id=requester.student_id,
        friend_department=requester.department
    )


@router.put("/{friend_id}/reject", status_code=status.HTTP_204_NO_CONTENT)
def reject_friend_request(
    friend_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """친구 요청 거절"""
    friend_request = db.query(Friend).filter(
        Friend.id == friend_id,
        Friend.friend_id == current_user.id,
        Friend.status == "pending"
    ).first()

    if not friend_request:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="친구 요청을 찾을 수 없습니다"
        )

    db.delete(friend_request)
    db.commit()


@router.delete("/{friend_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_friend(
    friend_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """친구 삭제"""
    friend = db.query(Friend).filter(
        Friend.id == friend_id,
        Friend.user_id == current_user.id
    ).first()

    if not friend:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="친구를 찾을 수 없습니다"
        )

    # 양방향 삭제
    db.query(Friend).filter(
        or_(
            and_(Friend.user_id == current_user.id, Friend.friend_id == friend.friend_id),
            and_(Friend.user_id == friend.friend_id, Friend.friend_id == current_user.id)
        )
    ).delete()

    db.commit()


@router.post("/free-time", response_model=List[FreeTimeSlot])
def compare_free_time(
    friend_ids: List[int],
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """공강 시간 비교"""
    days = ["월", "화", "수", "목", "금"]
    time_slots = ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00"]

    # 모든 사용자 ID (본인 포함)
    all_user_ids = [current_user.id] + friend_ids

    # 각 사용자의 시간표 조회
    all_schedules = db.query(Schedule).filter(
        Schedule.user_id.in_(all_user_ids)
    ).all()

    # 바쁜 시간 슬롯 계산
    busy_slots = set()
    for schedule in all_schedules:
        day = schedule.day
        start_hour = int(schedule.start_time.split(":")[0])
        end_hour = int(schedule.end_time.split(":")[0])

        for hour in range(start_hour, end_hour + 1):
            busy_slots.add((day, f"{hour:02d}:00"))

    # 공강 시간 찾기
    free_times = []
    for day in days:
        free_start = None
        for slot in time_slots:
            if (day, slot) not in busy_slots:
                if free_start is None:
                    free_start = slot
            else:
                if free_start is not None:
                    # 이전 슬롯까지가 공강
                    slot_idx = time_slots.index(slot)
                    if slot_idx > 0:
                        free_times.append(FreeTimeSlot(
                            day=f"{day}요일",
                            start_time=free_start,
                            end_time=slot
                        ))
                    free_start = None

        # 마지막 연속 공강 처리
        if free_start is not None:
            free_times.append(FreeTimeSlot(
                day=f"{day}요일",
                start_time=free_start,
                end_time="18:00"
            ))

    return free_times


@router.get("/search", response_model=List[FriendResponse])
def search_users(
    q: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """사용자 검색 (친구 추가용)"""
    users = db.query(User).filter(
        User.id != current_user.id,
        or_(
            User.name.contains(q),
            User.student_id.contains(q)
        )
    ).limit(20).all()

    result = []
    for user in users:
        # 이미 친구인지 확인
        existing = db.query(Friend).filter(
            or_(
                and_(Friend.user_id == current_user.id, Friend.friend_id == user.id),
                and_(Friend.user_id == user.id, Friend.friend_id == current_user.id)
            )
        ).first()

        status = existing.status if existing else None

        result.append(FriendResponse(
            id=0,
            user_id=current_user.id,
            friend_id=user.id,
            status=status or "none",
            created_at=user.created_at,
            friend_name=user.name,
            friend_student_id=user.student_id,
            friend_department=user.department
        ))

    return result
