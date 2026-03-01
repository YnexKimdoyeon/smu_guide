"""
알림 배지 API
"""
from datetime import datetime
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, or_

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.notification import AppLastViewed
from app.models.friend import Friend
from app.models.club import Club, ClubApplication
from app.models.meeting import Meeting, MeetingApplication
from app.models.chat import ChatMessage, ChatRoomMember

router = APIRouter(prefix="/notifications", tags=["알림"])


def get_last_viewed(db: Session, user_id: int, app_id: str) -> datetime:
    """앱 마지막 조회 시간 조회"""
    record = db.query(AppLastViewed).filter(
        AppLastViewed.user_id == user_id,
        AppLastViewed.app_id == app_id
    ).first()

    if record:
        return record.last_viewed_at
    # 처음 조회하는 경우 아주 오래된 시간 반환
    return datetime(2000, 1, 1)


@router.get("/badges")
async def get_notification_badges(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """각 앱의 알림 배지 수 조회"""
    badges = {}

    # 1. 친구 관리 - 받은 친구 요청 중 pending 상태
    friends_last = get_last_viewed(db, current_user.id, "friends")
    pending_requests = db.query(Friend).filter(
        Friend.friend_id == current_user.id,
        Friend.status == "pending",
        Friend.created_at > friends_last
    ).count()
    if pending_requests > 0:
        badges["friends"] = pending_requests

    # 2. 커뮤니티 - 내 동아리/과팅에 새 신청 + 매칭 알림 + 새 채팅
    community_last = get_last_viewed(db, current_user.id, "community")

    # 내 동아리에 새 신청
    my_clubs = db.query(Club.id).filter(Club.user_id == current_user.id).subquery()
    new_club_apps = db.query(ClubApplication).filter(
        ClubApplication.club_id.in_(my_clubs),
        ClubApplication.created_at > community_last
    ).count()

    # 내 과팅에 새 신청
    my_meetings = db.query(Meeting.id).filter(Meeting.user_id == current_user.id).subquery()
    new_meeting_apps = db.query(MeetingApplication).filter(
        MeetingApplication.meeting_id.in_(my_meetings),
        MeetingApplication.created_at > community_last
    ).count()

    # 내 신청이 새로 매칭됨 (내가 신청자인 경우)
    new_matches = db.query(MeetingApplication).filter(
        MeetingApplication.user_id == current_user.id,
        MeetingApplication.is_matched == 1
    ).join(Meeting, Meeting.id == MeetingApplication.meeting_id).filter(
        Meeting.updated_at > community_last
    ).count()

    # 내 매칭된 과팅 채팅방에 새 메시지
    # 1) 내가 작성한 매칭된 과팅
    my_matched_meetings = db.query(Meeting).filter(
        Meeting.user_id == current_user.id,
        Meeting.status == "matched",
        Meeting.chat_room_id.isnot(None)
    ).all()

    # 2) 내가 신청해서 매칭된 과팅
    my_matched_apps = db.query(MeetingApplication).filter(
        MeetingApplication.user_id == current_user.id,
        MeetingApplication.is_matched == 1
    ).all()

    matched_room_ids = []
    for m in my_matched_meetings:
        if m.chat_room_id:
            matched_room_ids.append(m.chat_room_id)
    for app in my_matched_apps:
        if app.meeting and app.meeting.chat_room_id:
            matched_room_ids.append(app.meeting.chat_room_id)

    # 새 채팅 메시지 수 (내가 보낸 것 제외)
    new_chat_count = 0
    if matched_room_ids:
        new_chat_count = db.query(ChatMessage).filter(
            ChatMessage.room_id.in_(matched_room_ids),
            ChatMessage.user_id != current_user.id,
            ChatMessage.created_at > community_last
        ).count()

    community_total = new_club_apps + new_meeting_apps + new_matches + new_chat_count
    if community_total > 0:
        badges["community"] = community_total

    return badges


@router.post("/viewed/{app_id}")
async def mark_app_viewed(
    app_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """앱 조회 시간 업데이트"""
    record = db.query(AppLastViewed).filter(
        AppLastViewed.user_id == current_user.id,
        AppLastViewed.app_id == app_id
    ).first()

    if record:
        record.last_viewed_at = func.now()
    else:
        record = AppLastViewed(
            user_id=current_user.id,
            app_id=app_id
        )
        db.add(record)

    db.commit()
    return {"message": "조회 시간이 업데이트되었습니다."}
