"""
관리자 페이지 API
"""
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime

from ..core.database import get_db
from ..models.user import User
from ..models.schedule import Schedule
from ..models.chat import ChatRoom, ChatMessage, ChatRoomMember
from ..models.chat import RandomChatRoom, RandomChatMessage
from ..models.friend import Friend
from ..models.commute import CommuteSchedule, CommuteGroup, CommuteGroupMember, CommuteChat
from ..models.club import Club, ClubApplication
from ..models.meeting import Meeting, MeetingApplication
from ..models.block import UserReport, UserBlock

router = APIRouter(prefix="/admin", tags=["관리자"])

ADMIN_PASSWORD = "bang0622@"


class LoginRequest(BaseModel):
    password: str


class LoginResponse(BaseModel):
    success: bool
    token: Optional[str] = None


@router.post("/login")
async def admin_login(request: LoginRequest):
    """관리자 로그인"""
    if request.password == ADMIN_PASSWORD:
        return {"success": True, "token": "admin_authenticated"}
    raise HTTPException(status_code=401, detail="비밀번호가 올바르지 않습니다.")


@router.get("/stats")
async def get_stats(db: Session = Depends(get_db)):
    """전체 통계"""
    total_users = db.query(func.count(User.id)).scalar()
    total_schedules = db.query(func.count(Schedule.id)).scalar()
    total_chat_messages = db.query(func.count(ChatMessage.id)).scalar()
    total_random_messages = db.query(func.count(RandomChatMessage.id)).scalar()
    total_friends = db.query(func.count(Friend.id)).filter(Friend.status == "accepted").scalar()
    total_clubs = db.query(func.count(Club.id)).scalar()
    total_meetings = db.query(func.count(Meeting.id)).scalar()
    total_reports = db.query(func.count(UserReport.id)).scalar()

    return {
        "total_users": total_users,
        "total_schedules": total_schedules,
        "total_chat_messages": total_chat_messages,
        "total_random_messages": total_random_messages,
        "total_friends": total_friends,
        "total_clubs": total_clubs,
        "total_meetings": total_meetings,
        "total_reports": total_reports,
    }


@router.get("/users")
async def get_all_users(db: Session = Depends(get_db)):
    """전체 유저 목록"""
    users = db.query(User).order_by(User.created_at.desc()).all()

    result = []
    for user in users:
        # 각 유저의 기본 통계
        schedule_count = db.query(func.count(Schedule.id)).filter(Schedule.user_id == user.id).scalar()
        chat_count = db.query(func.count(ChatMessage.id)).filter(ChatMessage.user_id == user.id).scalar()
        friend_count = db.query(func.count(Friend.id)).filter(
            ((Friend.user_id == user.id) | (Friend.friend_id == user.id)) &
            (Friend.status == "accepted")
        ).scalar()

        result.append({
            "id": user.id,
            "student_id": user.student_id,
            "name": user.name,
            "department": user.department,
            "created_at": user.created_at.isoformat() if user.created_at else None,
            "schedule_count": schedule_count,
            "chat_count": chat_count,
            "friend_count": friend_count,
        })

    return result


@router.get("/users/{user_id}")
async def get_user_detail(user_id: int, db: Session = Depends(get_db)):
    """유저 상세 정보"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="유저를 찾을 수 없습니다.")

    # 시간표
    schedules = db.query(Schedule).filter(Schedule.user_id == user_id).all()
    schedule_data = [{
        "id": s.id,
        "day": s.day,
        "start_time": s.start_time,
        "end_time": s.end_time,
        "subject": s.subject,
        "professor": s.professor,
        "room": s.room,
    } for s in schedules]

    # 채팅 메시지 (최근 100개)
    chat_messages = db.query(ChatMessage).filter(
        ChatMessage.user_id == user_id
    ).order_by(ChatMessage.created_at.desc()).limit(100).all()

    chat_data = []
    for msg in chat_messages:
        room = db.query(ChatRoom).filter(ChatRoom.id == msg.room_id).first()
        chat_data.append({
            "id": msg.id,
            "room_name": room.name if room else "Unknown",
            "message": msg.message,
            "created_at": msg.created_at.isoformat() if msg.created_at else None,
        })

    # 랜덤 채팅 메시지 (최근 100개)
    random_messages = db.query(RandomChatMessage).filter(
        RandomChatMessage.user_id == user_id
    ).order_by(RandomChatMessage.created_at.desc()).limit(100).all()

    random_chat_data = [{
        "id": msg.id,
        "room_id": msg.room_id,
        "message": msg.message,
        "created_at": msg.created_at.isoformat() if msg.created_at else None,
    } for msg in random_messages]

    # 친구 목록
    friends_sent = db.query(Friend).filter(Friend.user_id == user_id).all()
    friends_received = db.query(Friend).filter(Friend.friend_id == user_id).all()

    friend_data = []
    for f in friends_sent:
        friend_user = db.query(User).filter(User.id == f.friend_id).first()
        friend_data.append({
            "id": f.id,
            "direction": "sent",
            "friend_name": friend_user.name if friend_user else "Unknown",
            "friend_student_id": friend_user.student_id if friend_user else "Unknown",
            "status": f.status,
            "created_at": f.created_at.isoformat() if f.created_at else None,
        })
    for f in friends_received:
        friend_user = db.query(User).filter(User.id == f.user_id).first()
        friend_data.append({
            "id": f.id,
            "direction": "received",
            "friend_name": friend_user.name if friend_user else "Unknown",
            "friend_student_id": friend_user.student_id if friend_user else "Unknown",
            "status": f.status,
            "created_at": f.created_at.isoformat() if f.created_at else None,
        })

    # 등하교 스케줄
    commute_schedules = db.query(CommuteSchedule).filter(CommuteSchedule.user_id == user_id).all()
    commute_data = [{
        "id": c.id,
        "day": c.day,
        "commute_type": c.commute_type,
        "time": c.time,
        "location": c.location,
        "is_active": c.is_active,
    } for c in commute_schedules]

    # 등하교 채팅 메시지
    commute_chats = db.query(CommuteChat).filter(
        CommuteChat.user_id == user_id
    ).order_by(CommuteChat.created_at.desc()).limit(50).all()

    commute_chat_data = [{
        "id": c.id,
        "group_id": c.group_id,
        "message": c.message,
        "created_at": c.created_at.isoformat() if c.created_at else None,
    } for c in commute_chats]

    # 동아리 (생성한 것)
    clubs_created = db.query(Club).filter(Club.user_id == user_id).all()
    clubs_data = [{
        "id": c.id,
        "name": c.name,
        "description": c.description,
        "created_at": c.created_at.isoformat() if c.created_at else None,
    } for c in clubs_created]

    # 동아리 신청
    club_applications = db.query(ClubApplication).filter(ClubApplication.user_id == user_id).all()
    club_app_data = []
    for app in club_applications:
        club = db.query(Club).filter(Club.id == app.club_id).first()
        club_app_data.append({
            "id": app.id,
            "club_name": club.name if club else "Unknown",
            "created_at": app.created_at.isoformat() if app.created_at else None,
        })

    # 과팅 (생성한 것)
    meetings_created = db.query(Meeting).filter(Meeting.user_id == user_id).all()
    meetings_data = [{
        "id": m.id,
        "department": m.department,
        "member_count": m.member_count,
        "description": m.description,
        "status": m.status,
        "created_at": m.created_at.isoformat() if m.created_at else None,
    } for m in meetings_created]

    # 과팅 신청
    meeting_applications = db.query(MeetingApplication).filter(MeetingApplication.user_id == user_id).all()
    meeting_app_data = []
    for app in meeting_applications:
        meeting = db.query(Meeting).filter(Meeting.id == app.meeting_id).first()
        meeting_app_data.append({
            "id": app.id,
            "meeting_department": meeting.department if meeting else "Unknown",
            "message": app.message,
            "is_matched": app.is_matched,
            "created_at": app.created_at.isoformat() if app.created_at else None,
        })

    # 신고 (한 것)
    reports_sent = db.query(UserReport).filter(UserReport.reporter_id == user_id).all()
    reports_sent_data = []
    for r in reports_sent:
        reported_user = db.query(User).filter(User.id == r.reported_user_id).first()
        reports_sent_data.append({
            "id": r.id,
            "reported_user": reported_user.name if reported_user else "Unknown",
            "reason": r.reason,
            "detail": r.detail,
            "status": r.status,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        })

    # 신고 (받은 것)
    reports_received = db.query(UserReport).filter(UserReport.reported_user_id == user_id).all()
    reports_received_data = []
    for r in reports_received:
        reporter_user = db.query(User).filter(User.id == r.reporter_id).first()
        reports_received_data.append({
            "id": r.id,
            "reporter": reporter_user.name if reporter_user else "Unknown",
            "reason": r.reason,
            "detail": r.detail,
            "status": r.status,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        })

    # 차단 목록
    blocks = db.query(UserBlock).filter(UserBlock.user_id == user_id).all()
    blocks_data = []
    for b in blocks:
        blocked_user = db.query(User).filter(User.id == b.blocked_user_id).first()
        blocks_data.append({
            "id": b.id,
            "blocked_user": blocked_user.name if blocked_user else "Unknown",
            "blocked_student_id": blocked_user.student_id if blocked_user else "Unknown",
            "created_at": b.created_at.isoformat() if b.created_at else None,
        })

    return {
        "user": {
            "id": user.id,
            "student_id": user.student_id,
            "name": user.name,
            "department": user.department,
            "profile_image": user.profile_image,
            "created_at": user.created_at.isoformat() if user.created_at else None,
            "updated_at": user.updated_at.isoformat() if user.updated_at else None,
        },
        "schedules": schedule_data,
        "chat_messages": chat_data,
        "random_chat_messages": random_chat_data,
        "friends": friend_data,
        "commute_schedules": commute_data,
        "commute_chats": commute_chat_data,
        "clubs_created": clubs_data,
        "club_applications": club_app_data,
        "meetings_created": meetings_data,
        "meeting_applications": meeting_app_data,
        "reports_sent": reports_sent_data,
        "reports_received": reports_received_data,
        "blocks": blocks_data,
    }
