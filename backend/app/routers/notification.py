"""
알림 배지 API
"""
from datetime import datetime
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.notification import AppLastViewed
from app.models.friend import Friend
from app.models.club import Club, ClubApplication
from app.models.meeting import Meeting, MeetingApplication

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

    # 2. 커뮤니티 - 내 동아리/과팅에 새 신청
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

    community_total = new_club_apps + new_meeting_apps
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
