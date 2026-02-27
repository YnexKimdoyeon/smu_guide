from typing import List
from datetime import datetime, date
import random

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.commute import CommuteSchedule, CommuteGroup, CommuteGroupMember, CommuteChat
from app.schemas.commute import (
    CommuteScheduleCreate, CommuteScheduleResponse,
    CommuteGroupResponse, CommuteGroupMemberInfo,
    CommuteChatMessage, CommuteChatSend
)

router = APIRouter(prefix="/commute", tags=["등하교"])

DAYS = ["월", "화", "수", "목", "금", "토", "일"]
WEEKDAY_MAP = {0: "월", 1: "화", 2: "수", 3: "목", 4: "금", 5: "토", 6: "일"}


def time_to_minutes(time_str: str) -> int:
    """HH:MM을 분으로 변환"""
    h, m = map(int, time_str.split(":"))
    return h * 60 + m


def minutes_to_time(minutes: int) -> str:
    """분을 HH:MM으로 변환"""
    h = minutes // 60
    m = minutes % 60
    return f"{h:02d}:{m:02d}"


def is_within_range(time1: str, time2: str, range_minutes: int = 10) -> bool:
    """두 시간이 range_minutes 범위 내인지 확인"""
    m1 = time_to_minutes(time1)
    m2 = time_to_minutes(time2)
    return abs(m1 - m2) <= range_minutes


@router.get("/schedules", response_model=List[CommuteScheduleResponse])
def get_my_schedules(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """내 등하교 스케줄 조회"""
    schedules = db.query(CommuteSchedule).filter(
        CommuteSchedule.user_id == current_user.id,
        CommuteSchedule.is_active == 1
    ).all()
    return schedules


@router.post("/schedules", response_model=List[CommuteScheduleResponse])
def save_schedules(
    data: CommuteScheduleCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """등하교 스케줄 저장 (기존 스케줄 삭제 후 새로 저장)"""
    # 기존 스케줄 비활성화
    db.query(CommuteSchedule).filter(
        CommuteSchedule.user_id == current_user.id
    ).update({"is_active": 0})

    # 새 스케줄 저장
    new_schedules = []
    for item in data.schedules:
        schedule = CommuteSchedule(
            user_id=current_user.id,
            day=item.day,
            commute_type=item.commute_type,
            time=item.time,
            location=item.location,
            is_active=1
        )
        db.add(schedule)
        new_schedules.append(schedule)

    db.commit()

    for s in new_schedules:
        db.refresh(s)

    return new_schedules


@router.get("/groups/today", response_model=List[CommuteGroupResponse])
def get_today_groups(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """오늘의 내 매칭 그룹 조회"""
    today = date.today()

    # 내가 속한 그룹 조회
    my_groups = db.query(CommuteGroup).join(
        CommuteGroupMember, CommuteGroup.id == CommuteGroupMember.group_id
    ).filter(
        CommuteGroupMember.user_id == current_user.id,
        CommuteGroup.match_date == today
    ).all()

    result = []
    for group in my_groups:
        # 그룹 멤버 조회
        members = db.query(CommuteGroupMember, User).join(
            User, CommuteGroupMember.user_id == User.id
        ).filter(
            CommuteGroupMember.group_id == group.id
        ).all()

        member_list = [
            CommuteGroupMemberInfo(
                user_id=member.user_id,
                name=user.name,
                department=user.department
            )
            for member, user in members
        ]

        result.append(CommuteGroupResponse(
            id=group.id,
            match_date=group.match_date,
            day=group.day,
            commute_type=group.commute_type,
            location=group.location,
            time_slot=group.time_slot,
            members=member_list,
            member_count=len(member_list)
        ))

    return result


@router.post("/match")
def run_matching(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """오늘의 매칭 실행"""
    today = date.today()
    today_weekday = WEEKDAY_MAP[today.weekday()]

    # 오늘 요일의 모든 활성 스케줄 조회
    schedules = db.query(CommuteSchedule, User).join(
        User, CommuteSchedule.user_id == User.id
    ).filter(
        CommuteSchedule.day == today_weekday,
        CommuteSchedule.is_active == 1
    ).all()

    if not schedules:
        return {"message": "매칭할 스케줄이 없습니다", "groups_created": 0}

    # 등교/하교 + 장소별로 분류
    groups_by_type_location = {}
    for schedule, user in schedules:
        key = f"{schedule.commute_type}|{schedule.location or ''}"
        if key not in groups_by_type_location:
            groups_by_type_location[key] = []
        groups_by_type_location[key].append({
            "schedule": schedule,
            "user": user
        })

    groups_created = 0

    for key, items in groups_by_type_location.items():
        if len(items) < 2:
            continue

        commute_type, location = key.split("|", 1)

        # 시간대별로 그룹화 (±10분 범위)
        matched = set()
        time_groups = []

        # 시간순 정렬
        items.sort(key=lambda x: time_to_minutes(x["schedule"].time))

        for i, item in enumerate(items):
            if i in matched:
                continue

            group = [item]
            matched.add(i)

            for j in range(i + 1, len(items)):
                if j in matched:
                    continue

                if is_within_range(item["schedule"].time, items[j]["schedule"].time, 10):
                    group.append(items[j])
                    matched.add(j)

            if len(group) >= 2:
                time_groups.append(group)

        # 각 시간대 그룹에서 2~4명씩 랜덤 매칭
        for time_group in time_groups:
            random.shuffle(time_group)

            # 4명씩 끊기
            for k in range(0, len(time_group), 4):
                sub_group = time_group[k:k+4]

                if len(sub_group) < 2:
                    continue

                # 대표 시간 계산 (평균)
                avg_minutes = sum(time_to_minutes(m["schedule"].time) for m in sub_group) // len(sub_group)
                time_slot = minutes_to_time(avg_minutes)

                # 기존 동일 그룹 확인
                existing_group = None
                for member in sub_group:
                    existing = db.query(CommuteGroup).join(
                        CommuteGroupMember, CommuteGroup.id == CommuteGroupMember.group_id
                    ).filter(
                        CommuteGroup.match_date == today,
                        CommuteGroup.commute_type == commute_type,
                        CommuteGroupMember.user_id == member["user"].id
                    ).first()
                    if existing:
                        existing_group = existing
                        break

                if not existing_group:
                    # 새 그룹 생성
                    new_group = CommuteGroup(
                        match_date=today,
                        day=today_weekday,
                        commute_type=commute_type,
                        location=location,
                        time_slot=time_slot
                    )
                    db.add(new_group)
                    db.commit()
                    db.refresh(new_group)
                    existing_group = new_group
                    groups_created += 1

                # 멤버 추가
                for member in sub_group:
                    exists = db.query(CommuteGroupMember).filter(
                        CommuteGroupMember.group_id == existing_group.id,
                        CommuteGroupMember.user_id == member["user"].id
                    ).first()

                    if not exists:
                        new_member = CommuteGroupMember(
                            group_id=existing_group.id,
                            user_id=member["user"].id
                        )
                        db.add(new_member)

                db.commit()

    return {"message": "매칭 완료", "groups_created": groups_created}


@router.get("/groups/{group_id}/messages", response_model=List[CommuteChatMessage])
def get_group_messages(
    group_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """그룹 채팅 메시지 조회"""
    is_member = db.query(CommuteGroupMember).filter(
        CommuteGroupMember.group_id == group_id,
        CommuteGroupMember.user_id == current_user.id
    ).first()

    if not is_member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="이 그룹의 멤버가 아닙니다"
        )

    messages = db.query(CommuteChat, User).join(
        User, CommuteChat.user_id == User.id
    ).filter(
        CommuteChat.group_id == group_id
    ).order_by(CommuteChat.created_at).all()

    result = []
    for msg, user in messages:
        result.append(CommuteChatMessage(
            id=msg.id,
            group_id=msg.group_id,
            user_id=msg.user_id,
            sender=user.name,
            message=msg.message,
            is_mine=msg.user_id == current_user.id,
            created_at=msg.created_at
        ))

    return result


@router.post("/groups/messages", response_model=CommuteChatMessage)
def send_group_message(
    data: CommuteChatSend,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """그룹 채팅 메시지 전송"""
    is_member = db.query(CommuteGroupMember).filter(
        CommuteGroupMember.group_id == data.group_id,
        CommuteGroupMember.user_id == current_user.id
    ).first()

    if not is_member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="이 그룹의 멤버가 아닙니다"
        )

    new_message = CommuteChat(
        group_id=data.group_id,
        user_id=current_user.id,
        message=data.message
    )
    db.add(new_message)
    db.commit()
    db.refresh(new_message)

    return CommuteChatMessage(
        id=new_message.id,
        group_id=new_message.group_id,
        user_id=new_message.user_id,
        sender=current_user.name,
        message=new_message.message,
        is_mine=True,
        created_at=new_message.created_at
    )


@router.get("/groups/{group_id}", response_model=CommuteGroupResponse)
def get_group_detail(
    group_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """그룹 상세 정보 조회"""
    group = db.query(CommuteGroup).filter(CommuteGroup.id == group_id).first()

    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="그룹을 찾을 수 없습니다"
        )

    members = db.query(CommuteGroupMember, User).join(
        User, CommuteGroupMember.user_id == User.id
    ).filter(
        CommuteGroupMember.group_id == group.id
    ).all()

    member_list = [
        CommuteGroupMemberInfo(
            user_id=member.user_id,
            name=user.name,
            department=user.department
        )
        for member, user in members
    ]

    return CommuteGroupResponse(
        id=group.id,
        match_date=group.match_date,
        day=group.day,
        commute_type=group.commute_type,
        location=group.location,
        time_slot=group.time_slot,
        members=member_list,
        member_count=len(member_list)
    )
